import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase, isSupabaseReady, roomFilesBucket } from "@/utils/supabase";
import { formatBytes, formatDateTime } from "@/utils/formatting";
import RoomList from "@/components/RoomList";
import RoomForm from "@/components/RoomForm";
import RoomDetails from "@/components/RoomDetails";
import StatusMessage from "@/components/StatusMessage";

const initialRoomForm = {
  name: "",
  description: "",
  maxSharers: 6,
  maxFilesPerUser: 10,
  maxFileSizeMb: 200,
};

export default function App() {
  // User state
  const [displayName, setDisplayName] = useState(() => {
    const saved = localStorage.getItem("share-room-display-name");
    if (saved) return saved;
    return `Guest-${Math.floor(Math.random() * 9000) + 1000}`;
  });

  // Room state
  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [roomForm, setRoomForm] = useState(initialRoomForm);

  // Room details
  const [members, setMembers] = useState([]);
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

  const envReady = isSupabaseReady();

  // Save display name to localStorage
  useEffect(() => {
    localStorage.setItem("share-room-display-name", displayName);
  }, [displayName]);

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

      const [membersResponse, filesResponse] = await Promise.all([
        supabase
          .from("room_members")
          .select("id, room_id, sharer_name, joined_at")
          .eq("room_id", selectedRoomId)
          .order("joined_at", { ascending: true }),
        supabase
          .from("room_files")
          .select("id, room_id, uploader_name, file_name, file_size, storage_path, created_at")
          .eq("room_id", selectedRoomId)
          .order("created_at", { ascending: false }),
      ]);

      setLoadingRoomData(false);

      if (membersResponse.error || filesResponse.error) {
        console.error("loadRoomDetails error", membersResponse.error, filesResponse.error);
        const errorMsg = membersResponse.error?.message || filesResponse.error?.message || "Failed to load room details";
        setStatusMessage(errorMsg);
        return;
      }

      setMembers(membersResponse.data || []);
      setFiles(filesResponse.data || []);
      setStatusMessage("");
    };

    loadRoomDetails();
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

    if (members.length >= selectedRoom.max_sharers) {
      setStatusMessage("Room is full based on the creator rules.");
      return;
    }

    setBusyMessage("Joining room...");

    const { error } = await supabase.from("room_members").insert({
      room_id: selectedRoom.id,
      sharer_name: displayName,
    });

    setBusyMessage("");

    if (error) {
      console.error("joinRoom error", error);
      setStatusMessage(`Could not join room: ${error.message}`);
      return;
    }

    setStatusMessage(`Joined ${selectedRoom.name}. You can now share files.`);
    setSelectedRoomId(selectedRoom.id);
  };

  const handleUpload = async (event) => {
    event.preventDefault();

    if (!supabase || !selectedRoom) return;

    const formData = new FormData(event.currentTarget);
    const candidate = formData.get("roomFile");

    if (!(candidate instanceof File)) {
      setStatusMessage("Choose a file first.");
      return;
    }

    if (!hasJoinedSelectedRoom) {
      setStatusMessage("Join this room before uploading.");
      return;
    }

    if (candidate.size > selectedRoom.max_file_size_mb * 1024 * 1024) {
      setStatusMessage(`File exceeds ${selectedRoom.max_file_size_mb} MB room limit.`);
      return;
    }

    const uploadedByUser = files.filter((file) => file.uploader_name === displayName);
    if (uploadedByUser.length >= selectedRoom.max_files_per_user) {
      setStatusMessage(`You reached your ${selectedRoom.max_files_per_user} file limit in this room.`);
      return;
    }

    setBusyMessage("Uploading original file (zero-loss mode)...");

    const safeName = candidate.name.replace(/\s+/g, "-");
    const storagePath = `${selectedRoom.id}/${crypto.randomUUID()}-${safeName}`;

    const uploadResponse = await supabase.storage
      .from(roomFilesBucket)
      .upload(storagePath, candidate, { upsert: false });

    if (uploadResponse.error) {
      console.error("upload error", uploadResponse.error);
      setBusyMessage("");
      setStatusMessage(`Upload failed: ${uploadResponse.error.message}`);
      return;
    }

    const metadataResponse = await supabase.from("room_files").insert({
      room_id: selectedRoom.id,
      uploader_name: displayName,
      file_name: candidate.name,
      file_size: candidate.size,
      storage_path: storagePath,
    });

    setBusyMessage("");

    if (metadataResponse.error) {
      console.error("metadata insert error", metadataResponse.error);
      setStatusMessage(`File saved but metadata failed: ${metadataResponse.error.message}`);
      return;
    }

    setStatusMessage(`Shared ${candidate.name} with zero transcoding.`);
    event.currentTarget.reset();
    setSelectedRoomId(selectedRoom.id);
  };

  const handleDownload = async (file) => {
    if (!supabase) return;

    const { data, error } = await supabase.storage
      .from(roomFilesBucket)
      .createSignedUrl(file.storage_path, 120);

    if (error || !data?.signedUrl) {
      console.error("download link error", error, data);
      const errorMsg = error?.message || "Unknown error";
      setStatusMessage(`Download link failed: ${errorMsg}`);
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="shareroom-container container-fluid">
      <div className="row gx-4">
        <div className="col-lg-6 section-card mb-0">
          <div className="card">
            <div className="card-body">
              <span className="text-primary text-uppercase small fw-bold">✨ ShareRoom</span>
              <h1 className="my-3">Zero-Loss Rooms</h1>
              <p className="text-muted mb-4">
                Create collaborative spaces with enforced rules. Share files across any device without quality loss.
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
        </div>

        <div className="col-lg-6">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h2 className="h5 mb-0">Available rooms</h2>
            <button onClick={refreshRooms} className="btn btn-outline-secondary btn-sm">
              Refresh
            </button>
          </div>
          <p className="small text-muted mb-3">
            Share room links with collaborators. Rules enforced on upload.
          </p>

          <RoomList
            rooms={rooms}
            selectedRoomId={selectedRoomId}
            onSelectRoom={setSelectedRoomId}
            loading={loadingRooms}
          />

          {selectedRoom && (
            <div className="mt-3">
              <RoomDetails
                room={selectedRoom}
                hasJoined={hasJoinedSelectedRoom}
                members={members}
                files={files}
                loading={loadingRoomData}
                busyMessage={busyMessage}
                envReady={envReady}
                onJoin={handleJoinRoom}
                onUpload={handleUpload}
                onDownload={handleDownload}
              />
            </div>
          )}

          {statusMessage && <StatusMessage message={statusMessage} />}
        </div>
      </div>
    </div>
  );
}
