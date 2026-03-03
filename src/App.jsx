import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase, isSupabaseReady, roomFilesBucket } from "@/utils/supabase";
import { formatBytes, formatDateTime } from "@/utils/formatting";
import RoomList from "@/components/RoomList";
import RoomForm from "@/components/RoomForm";
import AuthForm from "@/components/AuthForm";
import UserList from "@/components/UserList";
import RoomDetails from "@/components/RoomDetails";

import StatusMessage from "@/components/StatusMessage";
import DirectShare from "@/components/DirectShare";
const initialRoomForm = {
  name: "",
  description: "",
  maxSharers: 6,
  maxFilesPerUser: 10,
  maxFileSizeMb: 200,
};

export default function App() {
      // Direct file sharing handler
      const handleDirectSend = async (toUser, files, done) => {
        // For demo: just show status. In production, upload to Supabase with metadata (fromUser, toUser)
        setBusyMessage(`Sending ${files.length} file(s) to ${toUser.name}...`);
        let sendErrors = [];
        await Promise.all(Array.from(files).map(async (candidate) => {
          // Integrity check: calculate SHA-256 hash
          const hashBuffer = await crypto.subtle.digest('SHA-256', await candidate.arrayBuffer());
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          const safeName = candidate.name.replace(/\s+/g, "-");
          const storageBase = `direct/${user.name}_to_${toUser.name}/${crypto.randomUUID()}-${safeName}`;
          const CHUNK_SIZE = 5 * 1024 * 1024;
          if (candidate.size > 20 * 1024 * 1024) {
            const totalChunks = Math.ceil(candidate.size / CHUNK_SIZE);
            for (let i = 0; i < totalChunks; i++) {
              const chunk = candidate.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
              const chunkPath = `${storageBase}.chunk${i}`;
              const uploadResponse = await supabase.storage
                .from(roomFilesBucket)
                .upload(chunkPath, chunk, { upsert: false });
              if (uploadResponse.error) {
                sendErrors.push(`Chunk ${i + 1}/${totalChunks} upload failed for ${candidate.name}: ${uploadResponse.error.message}`);
                return;
              }
            }
            // Metadata placeholder for direct sharing
            // In production, use a direct_files table for reassembly
          } else {
            const uploadResponse = await supabase.storage
              .from(roomFilesBucket)
              .upload(storageBase, candidate, { upsert: false });
            if (uploadResponse.error) {
              sendErrors.push(`Upload failed for ${candidate.name}: ${uploadResponse.error.message}`);
              return;
            }
          }
        }));
        setBusyMessage("");
        if (sendErrors.length > 0) {
          setStatusMessage(sendErrors.join("\n"));
        } else {
          setStatusMessage(`Sent ${files.length} file(s) to ${toUser.name}`);
        }
        if (done) done();
      };
    // All users from Supabase
    const [allUsers, setAllUsers] = useState([]);
    const [connections, setConnections] = useState([]);

    // Connect to a user
    const handleConnect = (user) => {
      if (!connections.some(u => u.id === user.id)) {
        setConnections(prev => [...prev, user]);
      }
    };
  // Auth state
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("share-room-user");
    return saved ? JSON.parse(saved) : null;
  });
  const [authing, setAuthing] = useState(false);

  // User display name
  const displayName = user?.name || "";
  const setDisplayName = (name) => {
    setUser(u => ({ ...u, name }));
    localStorage.setItem("share-room-user", JSON.stringify({ ...user, name }));
  };

  // Room state
  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [roomForm, setRoomForm] = useState(initialRoomForm);

  // Room details
  const [members, setMembers] = useState([]);
  const [pendingMembers, setPendingMembers] = useState([]);
  const [files, setFiles] = useState([]);

  // UI state
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingRoomData, setLoadingRoomData] = useState(false);
  const [busyMessage, setBusyMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const selectedRoom = useMemo(() => {
    return rooms.find((room) => room.id === selectedRoomId) || null;
  }, [rooms, selectedRoomId]);

  const hasJoinedSelectedRoom = useMemo(() => {
    if (!selectedRoomId) return false;
    return members.some((member) => member.sharer_name === displayName);
  }, [displayName, members, selectedRoomId]);

  const hasPendingRequest = useMemo(() => {
    if (!selectedRoomId) return false;
    return pendingMembers.some((member) => member.sharer_name === displayName);
  }, [displayName, pendingMembers, selectedRoomId]);

  const envReady = isSupabaseReady();

  // Save display name to localStorage
  useEffect(() => {
        // Fetch all users from Supabase
        const fetchUsers = async () => {
          if (!supabase) return;
          const { data, error } = await supabase
            .from("users") // You need a 'users' table in Supabase with at least id, name columns
            .select("id, name");
          if (error) {
            console.error("fetchUsers error", error);
            setAllUsers([]);
          } else if (data) {
            console.log("fetched users", data);
            if (data.length === 0 && user) {
              console.warn("Query returned no rows even though a user is logged in. " +
                "This usually means the users table is empty or a Row-Level Security policy " +
                "is filtering out results. Make sure you have a public/select policy on the table.");
            }
            setAllUsers(data);
          }
        };
        fetchUsers();
        // Optionally, add a realtime subscription for users
        const usersSub = supabase
          .channel('users-changes')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, payload => {
            fetchUsers();
          })
          .subscribe();
        return () => {
          supabase.removeChannel(usersSub);
        };
    if (user) {
      localStorage.setItem("share-room-user", JSON.stringify(user));
    }
  }, [user]);

  // Logout handler
  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setAllUsers([]);
    setConnections([]);
    localStorage.removeItem("share-room-user");
    setStatusMessage("Logged out.");
  };

  // Auth handler
  const handleAuth = async ({ name, email, password, mode }) => {
    setAuthing(true);
    let authResult;
    try {
      if (mode === 'signup') {
        authResult = await supabase.auth.signUp({ email, password });
      } else {
        authResult = await supabase.auth.signInWithPassword({ email, password });
      }
    } catch (err) {
      const errorMsg = err?.message || 'Authentication failed';
      console.error('Auth request exception:', err);
      setStatusMessage(errorMsg);
      setAuthing(false);
      return;
    }
    const { data, error } = authResult;
    if (error) {
      const errorMsg = error.message || error.error_description || JSON.stringify(error);
      console.error('Auth error response:', error);
      setStatusMessage(`Auth failed: ${errorMsg}`);
      setAuthing(false);
      return;
    }
    // Get user info
    try {
      const { data: userData } = await supabase.auth.getUser();
      setUser(userData.user);
      localStorage.setItem("share-room-user", JSON.stringify(userData.user));

      // Ensure we have a row in the users table for everyone who signs in
      if (userData.user?.id) {
        const profile = {
          id: userData.user.id,
          email: userData.user.email,
          // use the supplied name on signup, otherwise fall back to email
          name: name || userData.user.email || "",
          created_at: new Date().toISOString(),
        };
        try {
          const { error: upsertErr } = await supabase.from('users').upsert(profile);
          if (upsertErr) {
            console.error('User upsert error', upsertErr);
            setStatusMessage("Warning: could not write profile row. Check your 'users' table policies.");
          } else {
            console.log('User profile upserted successfully:', profile);
          }
        } catch (upsertErr) {
          console.error('Exception during user upsert', upsertErr);
          setStatusMessage("Warning: exception while writing profile. See console for details.");
        }
        if (mode === 'signup' && name) {
          setDisplayName(name);
        }
      }

      setStatusMessage(mode === 'signup' ? 'Account created successfully!' : 'Logged in successfully!');
    } catch (err) {
      console.error('Could not retrieve user after auth', err);
    }
    setAuthing(false);
  };
  // Accept/decline invitation
  const handleInvitationResponse = async (invitationId, status) => {
    if (!supabase) return;
    setBusyMessage("Updating invitation...");
    const { data, error } = await supabase
      .from("room_invitations")
      .update({ status })
      .eq("id", invitationId)
      .select();
    setBusyMessage("");
    if (error) {
      setStatusMessage(`Could not update invitation: ${error.message}`);
    } else {
      setStatusMessage(`Invitation ${status}.`);
      // If accepted, auto-join room
      if (status === "accepted" && data && data[0]) {
        const roomId = data[0].room_id;
        // update pending request to accepted
        await supabase.from("room_members").update({ status: 'accepted' }).eq('room_id', roomId).eq('sharer_name', displayName);
        setSelectedRoomId(roomId);
      }
    }
  };

  const [invitations, setInvitations] = useState([]);
  useEffect(() => {
    let invSub = null;
    const fetchInvitations = async () => {
      try {
        if (!supabase || !user || !user.id) return;
        // Join with rooms to get room name
        const { data, error } = await supabase
          .from("room_invitations")
          .select("id, room_id, invited_by, status, created_at, rooms(name)")
          .eq("user_id", user.id)
          .eq("status", "pending");
        if (error) {
          console.error("fetchInvitations error", error);
        } else if (data) {
          setInvitations(data);
        }
      } catch (err) {
        console.error("Unexpected error fetching invitations:", err);
      }
    };

    // Only fetch/subscribe when user.id is available
    if (user && user.id) {
      fetchInvitations();
      try {
        invSub = supabase
          .channel('inv-changes')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'room_invitations', filter: `user_id=eq.${user.id}` }, payload => {
            fetchInvitations();
          })
          .subscribe();
      } catch (err) {
        console.error('Failed to subscribe to invitations channel', err);
        invSub = null;
      }
    }

    return () => {
      if (invSub) supabase.removeChannel(invSub);
    };
  }, [user]);

  // Load all rooms on mount
  useEffect(() => {
    const loadRooms = async () => {
      if (!supabase) return;
      setLoadingRooms(true);
      const { data, error } = await supabase
        .from("rooms")
        .select("id, name, description, creator_name, max_sharers, max_files_per_user, max_file_size_mb, created_at")
        .order("created_at", { ascending: false });
      setLoadingRooms(false);
      if (error) {
        console.error("loadRooms error", error);
        setStatusMessage(`Could not load rooms: ${error.message}`);
        return;
      }
      setRooms(data || []);
      setStatusMessage("");
    };
    loadRooms();

    // Supabase realtime subscription for rooms
    const roomsSub = supabase
      .channel('rooms-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, payload => {
        loadRooms();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(roomsSub);
    };
  }, []);

  // Cleanup stale pending membership requests (older than 7 days)
  useEffect(() => {
    const cleanupStalePendingRequests = async () => {
      if (!supabase) return;

      const STALE_THRESHOLD_DAYS = 7;
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - STALE_THRESHOLD_DAYS);

      // Clean up stale pending membership requests
      try {
        const { error: memberError } = await supabase
          .from("room_members")
          .delete()
          .eq("status", "pending")
          .lt("created_at", staleDate.toISOString());
        if (memberError) {
          // Suppress "column does not exist" errors - expected if schema isn't fully set up
          if (memberError.message?.includes("does not exist")) {
            // silently skip
          } else {
            console.warn("Cleanup warning for room_members:", memberError?.message || memberError);
          }
        }
      } catch (err) {
        // silently ignore cleanup exceptions
      }

      // Clean up stale pending invitations as well
      try {
        const { error: invitationError } = await supabase
          .from("room_invitations")
          .delete()
          .eq("status", "pending")
          .lt("created_at", staleDate.toISOString());
        if (invitationError) {
          // Suppress "relation does not exist" and "column does not exist" errors
          if (invitationError.code === 'PGRST116' || invitationError.message?.includes("does not exist")) {
            // silently skip
          } else {
            console.warn("Cleanup warning for room_invitations:", invitationError?.message || invitationError);
          }
        }
      } catch (err) {
        // silently ignore cleanup exceptions
      }
    };

    // Clean up on load
    cleanupStalePendingRequests();

    // Set up periodic cleanup (every hour)
    const cleanupInterval = setInterval(cleanupStalePendingRequests, 60 * 60 * 1000);

    return () => {
      clearInterval(cleanupInterval);
    };
  }, []);

  // Load room details when selected room changes
  useEffect(() => {
    const loadRoomDetails = async () => {
      if (!selectedRoomId || !supabase) {
        setMembers([]);
        setFiles([]);
        return;
      }
      setLoadingRoomData(true);
      let membersResponse, filesResponse;
      try {
        [membersResponse, filesResponse] = await Promise.all([
          supabase
            .from("room_members")
            .select("id, room_id, sharer_name, joined_at, status")
            .eq("room_id", selectedRoomId)
            .order("joined_at", { ascending: true }),
          supabase
            .from("room_files")
            .select("id, room_id, uploader_name, file_name, file_size, storage_path, created_at, file_hash")
            .eq("room_id", selectedRoomId)
            .order("created_at", { ascending: false }),
        ]);
      } catch (err) {
        // If selecting status fails (column missing), retry members without status
        console.warn('Initial loadRoomDetails query failed, retrying without status if possible', err?.message || err);
        filesResponse = await supabase
          .from("room_files")
          .select("id, room_id, uploader_name, file_name, file_size, storage_path, created_at, file_hash")
          .eq("room_id", selectedRoomId)
          .order("created_at", { ascending: false });
        membersResponse = await supabase
          .from("room_members")
          .select("id, room_id, sharer_name, joined_at")
          .eq("room_id", selectedRoomId)
          .order("joined_at", { ascending: true });
      }
      setLoadingRoomData(false);
      if (membersResponse.error || filesResponse.error) {
        console.error("loadRoomDetails error", membersResponse.error, filesResponse.error);
        const errorMsg = membersResponse.error?.message || filesResponse.error?.message || "Failed to load room details";
        setStatusMessage(errorMsg);
        return;
      }
      const membersData = membersResponse.data || [];
      setMembers(membersData);
      // maintain pending member list separately so UI can show approvals
      setPendingMembers(membersData.filter(m => m.status === "pending"));
      // remove expired files locally and from storage
      const now = new Date().toISOString();
      const expired = (filesResponse.data || []).filter(f => f.expires_at && f.expires_at < now);
      for (const f of expired) {
        await supabase.storage.from(roomFilesBucket).remove([f.storage_path]);
        await supabase.from("room_files").delete().eq("id", f.id);
      }
      const validFiles = (filesResponse.data || []).filter(f => !f.expires_at || f.expires_at >= now);
      setFiles(validFiles);
      setStatusMessage("");
    };
    loadRoomDetails();

    // Supabase realtime subscription for room_members and room_files
    let membersSub, filesSub;
    if (selectedRoomId && supabase) {
      membersSub = supabase
        .channel('members-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${selectedRoomId}` }, payload => {
          loadRoomDetails();
        })
        .subscribe();
      filesSub = supabase
        .channel('files-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'room_files', filter: `room_id=eq.${selectedRoomId}` }, payload => {
          loadRoomDetails();
        })
        .subscribe();
    }
    return () => {
      if (membersSub) supabase.removeChannel(membersSub);
      if (filesSub) supabase.removeChannel(filesSub);
    };
  }, [selectedRoomId]);

  const refreshRooms = useCallback(async () => {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("rooms")
      .select("id, name, description, creator_name, max_sharers, max_files_per_user, max_file_size_mb, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setStatusMessage(`Refresh failed: ${error.message}`);
      return;
    }

    setRooms(data || []);
  }, []);

  // Delete room handler
  const handleDeleteRoom = async (roomId) => {
    if (!supabase) return;
    setBusyMessage("Deleting room...");
    const { error } = await supabase
      .from("rooms")
      .delete()
      .eq("id", roomId);
    setBusyMessage("");
    if (error) {
      setStatusMessage(`Could not delete room: ${error.message}`);
    } else {
      setStatusMessage("Room deleted.");
      setSelectedRoomId(null);
      await refreshRooms();
    }
  };

  // Invite connected users to room
  const handleInviteUser = async (userId, roomId) => {
    if (!supabase) return;
    setBusyMessage("Inviting user...");
    // You need a 'room_invitations' table in Supabase: id, room_id, user_id, invited_by, status
    const { error } = await supabase
      .from("room_invitations")
      .insert({ room_id: roomId, user_id: userId, invited_by: user.id, status: "pending" });
    setBusyMessage("");
  };

  // Approve a pending request to join the room
  const handleApproveMember = async (memberId) => {
    if (!supabase) return;
    setBusyMessage("Approving member...");
    const { error } = await supabase
      .from("room_members")
      .update({ status: 'approved', joined_at: new Date().toISOString() })
      .eq("id", memberId);
    setBusyMessage("");
    if (error) {
      setStatusMessage(`Could not approve member: ${error.message}`);
    } else {
      setStatusMessage("Member approved.");
      setPendingMembers(prev => prev.filter(m => m.id !== memberId));
    }
  };

  // Deny a pending request (remove the entry)
  const handleDenyMember = async (memberId) => {
    if (!supabase) return;
    setBusyMessage("Denying member...");
    const { error } = await supabase
      .from("room_members")
      .delete()
      .eq("id", memberId);
    setBusyMessage("");
    if (error) {
      setStatusMessage(`Could not deny member: ${error.message}`);
    } else {
      setStatusMessage("Member denied.");
      setPendingMembers(prev => prev.filter(m => m.id !== memberId));
    }
  };

  const handleCreateRoom = async (event) => {
    event.preventDefault();

    if (!supabase) return;
    if (!roomForm.name.trim()) {
      setStatusMessage("Room name is required.");
      return;
    }

    setBusyMessage("Creating room...");

    const payload = {
      name: roomForm.name.trim(),
      description: roomForm.description.trim(),
      creator_name: displayName,
      max_sharers: roomForm.maxSharers,
      max_files_per_user: roomForm.maxFilesPerUser,
      max_file_size_mb: roomForm.maxFileSizeMb,
    };

    const { data, error } = await supabase
      .from("rooms")
      .insert(payload)
      .select()
      .single();

    setBusyMessage("");

    if (error) {
      console.error("createRoom error", error);
      setStatusMessage(`Could not create room: ${error.message}`);
      return;
    }

    setRoomForm(initialRoomForm);
    setStatusMessage("Room created successfully.");
    setSelectedRoomId(data.id);
    await refreshRooms();
  };

  const handleJoinRoom = async () => {
    if (!supabase || !selectedRoom) return;

    if (hasJoinedSelectedRoom) {
      setStatusMessage("You already joined this room.");
      return;
    }
    if (hasPendingRequest) {
      setStatusMessage("Join request already pending.");
      return;
    }

    if (members.length >= selectedRoom.max_sharers) {
      setStatusMessage("Room is full based on the creator rules.");
      return;
    }

    setBusyMessage("Requesting to join room...");

    const { data, error } = await supabase.from("room_members").insert({
      room_id: selectedRoom.id,
      sharer_name: displayName,
      status: 'pending',
    }).select().single();

    setBusyMessage("");

    if (error) {
      console.error("joinRoom error", error);
      setStatusMessage(`Could not request to join room: ${error.message}`);
      return;
    }

    // update local pending cache so UI updates immediately
    if (data) {
      setPendingMembers(prev => [...prev, data]);
    }

    setStatusMessage(`Request sent to join ${selectedRoom.name}. Awaiting approval.`);
    setSelectedRoomId(selectedRoom.id);
  };

  const handleUpload = async (event) => {
    event.preventDefault();

    if (!supabase || !selectedRoom) return;

    const formData = new FormData(event.currentTarget);
    const filesList = event.currentTarget.roomFile.files;
    const retentionDays = Number(formData.get("retention")) || 7;
    if (!filesList || filesList.length === 0) {
      setStatusMessage("Choose at least one file.");
      return;
    }

    if (!hasJoinedSelectedRoom) {
      setStatusMessage("Join this room before uploading.");
      return;
    }

    const uploadedByUser = files.filter((file) => file.uploader_name === displayName);
    if (uploadedByUser.length + filesList.length > selectedRoom.max_files_per_user) {
      setStatusMessage(`You will exceed your ${selectedRoom.max_files_per_user} file limit in this room.`);
      return;
    }

    let uploadErrors = [];
    setBusyMessage(`Uploading ${filesList.length} file(s) in zero-loss mode...`);

    await Promise.all(Array.from(filesList).map(async (candidate) => {
      if (candidate.size > selectedRoom.max_file_size_mb * 1024 * 1024) {
        uploadErrors.push(`${candidate.name} exceeds ${selectedRoom.max_file_size_mb} MB room limit.`);
        return;
      }

      // Integrity check: calculate SHA-256 hash
      const hashBuffer = await crypto.subtle.digest('SHA-256', await candidate.arrayBuffer());
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const safeName = candidate.name.replace(/\s+/g, "-");
      const storageBase = `${selectedRoom.id}/${crypto.randomUUID()}-${safeName}`;
      const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString();

      // Chunked upload for files > 20MB
      const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
      if (candidate.size > 20 * 1024 * 1024) {
        const totalChunks = Math.ceil(candidate.size / CHUNK_SIZE);
        for (let i = 0; i < totalChunks; i++) {
          const chunk = candidate.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          const chunkPath = `${storageBase}.chunk${i}`;
          const uploadResponse = await supabase.storage
            .from(roomFilesBucket)
            .upload(chunkPath, chunk, { upsert: false });
          if (uploadResponse.error) {
            uploadErrors.push(`Chunk ${i + 1}/${totalChunks} upload failed for ${candidate.name}: ${uploadResponse.error.message}`);
            return;
          }
        }
        // Store metadata for reassembly
        const metadataResponse = await supabase.from("room_files").insert({
          room_id: selectedRoom.id,
          uploader_name: displayName,
          file_name: candidate.name,
          file_size: candidate.size,
          storage_path: storageBase,
          file_hash: hashHex,
          chunked: true,
          chunk_count: totalChunks,
          expires_at: expiresAt,
        });
        if (metadataResponse.error) {
          uploadErrors.push(`File saved but metadata failed for ${candidate.name}: ${metadataResponse.error.message}`);
          return;
        }
      } else {
        // Single upload for small files
        const uploadResponse = await supabase.storage
          .from(roomFilesBucket)
          .upload(storageBase, candidate, { upsert: false });
        if (uploadResponse.error) {
          uploadErrors.push(`Upload failed for ${candidate.name}: ${uploadResponse.error.message}`);
          return;
        }
        const metadataResponse = await supabase.from("room_files").insert({
          room_id: selectedRoom.id,
          uploader_name: displayName,
          file_name: candidate.name,
          file_size: candidate.size,
          storage_path: storageBase,
          file_hash: hashHex,
          chunked: false,
          expires_at: expiresAt,
        });
        if (metadataResponse.error) {
          uploadErrors.push(`File saved but metadata failed for ${candidate.name}: ${metadataResponse.error.message}`);
          return;
        }
      }
    }));

    setBusyMessage("");
    if (uploadErrors.length > 0) {
      setStatusMessage(uploadErrors.join("\n"));
    } else {
      setStatusMessage(`Shared ${filesList.length} file(s) with zero transcoding.`);
    }
    event.currentTarget.reset();
    setSelectedRoomId(selectedRoom.id);
  };

  const handleDownload = async (file) => {
    if (!supabase) return;

    // Support single or multiple files
    const filesToDownload = Array.isArray(file) ? file : [file];
    setBusyMessage(`Downloading ${filesToDownload.length} file(s)...`);
    let downloadErrors = [];

    await Promise.all(filesToDownload.map(async (f) => {
      const { data, error } = await supabase.storage
        .from(roomFilesBucket)
        .createSignedUrl(f.storage_path, 120);

      if (error || !data?.signedUrl) {
        downloadErrors.push(`Download link failed for ${f.file_name}: ${error?.message || "Unknown error"}`);
        return;
      }

      try {
        const response = await fetch(data.signedUrl);
        if (!response.ok) throw new Error("Failed to fetch file");
        const blob = await response.blob();

        // Integrity check: calculate SHA-256 hash and compare to metadata
        const hashBuffer = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        if (f.file_hash && f.file_hash !== hashHex) {
          downloadErrors.push(`Integrity check failed for ${f.file_name}`);
          return;
        }

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = f.file_name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } catch (err) {
        downloadErrors.push(`Download failed for ${f.file_name}: ${err.message}`);
      }
    }));

    setBusyMessage("");
    if (downloadErrors.length > 0) {
      setStatusMessage(downloadErrors.join("\n"));
    } else {
      setStatusMessage(`Download started for ${filesToDownload.length} file(s)`);
    }
  };

  return (
    <div className="shareroom-container container-fluid">
      {/* Show pending invitations */}
      {invitations.length > 0 && (
        <div className="mb-3">
          <h6>Pending Room Invitations</h6>
          <ul className="list-group">
            {invitations.map(inv => (
              <li key={inv.id} className="list-group-item d-flex justify-content-between align-items-center">
                <span>Room: {inv.rooms?.name || inv.room_id} | Invited by: {inv.invited_by}</span>
                <div>
                  <button className="btn btn-success btn-sm me-2" onClick={() => handleInvitationResponse(inv.id, "accepted")}>Accept</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleInvitationResponse(inv.id, "declined")}>Decline</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!user ? (
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-4">
            <h1 className="mb-4">Smart Share</h1>
            <p className="small text-muted mb-3">Sign up or login to start sharing files.</p>
            <AuthForm onAuth={handleAuth} />
          </div>
        </div>
      ) : (
        <div>
          {/* Main two-column layout: Rooms on left, User search on right */}
          <div className="row gx-4 mb-4">
            {/* LEFT COLUMN: Create Room + Available Rooms */}
            <div className="col-lg-6">
              <div className="card section-card mb-4">
                <div className="card-body">
                  <span className="text-primary text-uppercase small fw-bold">✨ ShareRoom</span>
                  <h1 className="my-3">Zero-Loss Rooms</h1>
                  <p className="text-muted mb-4">
                    Create collaborative spaces with enforced rules. Share files without quality loss.
                  </p>

                  <div className="mb-4">
                    <label className="form-label">Your Display Name</label>
                    <div className="input-group">
                      <input
                        type="text"
                        value={displayName}
                        onChange={(event) => setDisplayName(event.target.value)}
                        className="form-control"
                        placeholder="e.g., Alice"
                        maxLength={40}
                      />
                      <span className="input-group-text bg-white border-2" style={{borderColor: 'var(--primary-color)'}}>
                        {envReady ? '🔗' : '⚠️'}
                      </span>
                      <button 
                        className="btn btn-outline-danger btn-sm" 
                        onClick={handleLogout}
                        title="Sign out of your account"
                      >
                        🚪
                      </button>
                    </div>
                    <small className="text-muted d-block mt-2">
                      {envReady
                        ? "✓ Connected to Supabase"
                        : "⚠️ Set VITE_SUPABASE_URL and ANON_KEY in .env.local"}
                    </small>
                  </div>

                  <RoomForm
                    form={roomForm}
                    onFormChange={setRoomForm}
                    onSubmit={handleCreateRoom}
                    busyMessage={busyMessage}
                    envReady={envReady}
                  />
                </div>
              </div>

              <div className="card">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="mb-0">📋 Available Rooms</h5>
                    <button onClick={refreshRooms} className="btn btn-outline-secondary btn-sm">
                      Refresh
                    </button>
                  </div>
                  <p className="small text-muted mb-3">
                    Rooms you can join or manage.
                  </p>

                  <RoomList
                    rooms={rooms}
                    selectedRoomId={selectedRoomId}
                    onSelectRoom={setSelectedRoomId}
                    loading={loadingRooms}
                    onDeleteRoom={handleDeleteRoom}
                  />
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: User Search + Connections + Invitations */}
            <div className="col-lg-6 order-lg-last search d-lg-flex flex-lg-column">
              {/* User Search (sticky on lg+) */}
              <div className="card mb-4 position-sticky" style={{ top: '1rem', zIndex: 1 }}>
                <div className="card-body">
                  <h5 className="card-title mb-3">🔍 Find & Connect Users</h5>
                  <UserList users={allUsers.filter(u => u.name !== displayName)} onConnect={handleConnect} />
                </div>
              </div>

              {/* Pending Invitations */}
              {invitations.length > 0 && (
                <div className="card mb-4">
                  <div className="card-body">
                    <h5 className="card-title mb-3">📬 Pending Invitations</h5>
                    <ul className="list-group">
                      {invitations.map(inv => (
                        <li key={inv.id} className="list-group-item d-flex justify-content-between align-items-center">
                          <div>
                            <div className="fw-bold">{inv.rooms?.name || inv.room_id}</div>
                            <small className="text-muted">from {inv.invited_by}</small>
                          </div>
                          <div className="btn-group btn-group-sm">
                            <button className="btn btn-success" onClick={() => handleInvitationResponse(inv.id, "accepted")}>✓</button>
                            <button className="btn btn-danger" onClick={() => handleInvitationResponse(inv.id, "declined")}>✕</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Connected Users */}
              {connections.length > 0 && (
                <div className="card">
                  <div className="card-body">
                    <h5 className="card-title mb-3">👥 Connected Users ({connections.length})</h5>
                    <ul className="list-group mb-3">
                      {connections.map(connUser => (
                        <li key={connUser.id} className="list-group-item d-flex justify-content-between align-items-center">
                          <span>{connUser.name}</span>
                          <span className="badge bg-success">Connected</span>
                        </li>
                      ))}
                    </ul>

                    {/* Invite to room section */}
                    {selectedRoom && (
                      <div className="mt-3 border-top pt-3">
                        <h6 className="mb-2">📤 Invite to Room</h6>
                        <p className="small text-muted mb-2">{selectedRoom.name}</p>
                        <ul className="list-group list-group-sm">
                          {connections.filter(c => !members.some(m => m.sharer_name === c.name)).map(connUser => (
                            <li key={connUser.id} className="list-group-item d-flex justify-content-between align-items-center">
                              <span className="small">{connUser.name}</span>
                              <button className="btn btn-outline-primary btn-sm" onClick={() => handleInviteUser(connUser.id, selectedRoom.id)}>
                                Invite
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Direct sharing */}
                    <div className="mt-3 border-top pt-3">
                      <h6 className="mb-2">📁 Direct Share</h6>
                      {connections.map(connUser => (
                        <DirectShare key={connUser.id} user={connUser} onSend={handleDirectSend} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Status messages (full width below main content) */}
          {statusMessage && (
            <div className="row mb-4">
              <div className="col-12">
                <StatusMessage message={statusMessage} />
              </div>
            </div>
          )}

          {/* Room details (full width when selected) */}
          {selectedRoom && (
            <div className="row mb-4">
              <div className="col-12">
                <RoomDetails
                  room={selectedRoom}
                  hasJoined={hasJoinedSelectedRoom}
                  hasPending={hasPendingRequest}
                  members={members}
                  pendingMembers={pendingMembers}
                  files={files}
                  loading={loadingRoomData}
                  busyMessage={busyMessage}
                  envReady={envReady}
                  onJoin={handleJoinRoom}
                  onUpload={handleUpload}
                  onDownload={handleDownload}
                  onApproveMember={handleApproveMember}
                  onDenyMember={handleDenyMember}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
