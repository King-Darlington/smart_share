# ShareRoom v1.0 - Zero-Loss Cross-Platform File Sharing

A modern web application for creating collaborative "share rooms" where users can exchange files with **zero quality loss** across any platform (iPhone, Android, Windows, macOS, Linux, etc.).

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ installed
- A Supabase project with credentials

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Supabase:**
   - Copy `.env.local` file to your project root (already created)
   - Update it with your Supabase credentials:
     ```env
     VITE_SUPABASE_URL=your_project_url
     VITE_SUPABASE_ANON_KEY=your_anon_key
     ```

3. **Run development server:**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:5173`

4. **Build for production:**
   ```bash
   npm run build
   ```

## 📋 System Requirements

### Must-Have Supabase Configuration

Before running this app, set up your Supabase project with these tables and storage:

#### 1. Create `rooms` Table
```sql
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  creator_name VARCHAR(100) NOT NULL,
  max_sharers INTEGER NOT NULL DEFAULT 6,
  max_files_per_user INTEGER NOT NULL DEFAULT 10,
  max_file_size_mb INTEGER NOT NULL DEFAULT 200,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 2. Create `room_members` Table
```sql
CREATE TABLE room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  sharer_name VARCHAR(100) NOT NULL,
  joined_at TIMESTAMP DEFAULT NOW()
);
```

#### 3. Create `room_files` Table
```sql
CREATE TABLE room_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  uploader_name VARCHAR(100) NOT NULL,
  file_name VARCHAR(500) NOT NULL,
  file_size BIGINT NOT NULL,
  storage_path VARCHAR(1000) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 4. Create `users` Table (for profile data)
The app keeps a simple `users` table so that people can search for others by display name. You must give the client permission to **select**, **insert**, and **update** rows in this table (typically restricted to the signed‑in user).

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  name VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);
```

Policies you can add (paste into SQL editor):

```sql
-- anyone (even anonymous) can see basic profiles
ALTER POLICY "Public read user profiles" ON public.users
  FOR SELECT
  USING (true);

-- allow logged-in users to create their own profile row
ALTER POLICY "Insert own profile" ON public.users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- allow users to modify only their row
ALTER POLICY "Update own profile" ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
```

If you'd rather require authentication for SELECT as well, change the first policy to `USING (auth.uid() IS NOT NULL)`.

> 🛠 **Troubleshooting**: After signup the app will try to `upsert` your profile. If the `users` table is empty or you see a warning that profiles couldn't be written, it's almost always due to missing/incorrect policies. The console log now prints both successes and errors so you can inspect what went wrong.

The signup flow in the app upserts a new row in this table with the chosen name. Without correct policies, the row is never created and the user list remains empty.

#### 5. Create `user_connections` Table (for persistent connections)
Stores bidirectional user connections/relationships for the "find & connect users" feature.

```sql
CREATE TABLE user_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_a, user_b),
  CHECK (user_a < user_b)
);

-- Policies: allow users to see/create/update their own connections
CREATE POLICY "Users can see their connections" ON public.user_connections
  FOR SELECT
  USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE POLICY "Users can create connections" ON public.user_connections
  FOR INSERT
  WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);

CREATE POLICY "Users can update their connections" ON public.user_connections
  FOR UPDATE
  USING (auth.uid() = user_a OR auth.uid() = user_b);
```

#### 6. Create `direct_shares` Table (for direct file sharing)
Tracks direct P2P file transfers between users.

```sql
CREATE TABLE direct_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name VARCHAR(500) NOT NULL,
  storage_path VARCHAR(1000) NOT NULL,
  file_type VARCHAR(20) NOT NULL,
  file_size BIGINT NOT NULL,
  file_hash VARCHAR(64),
  downloaded BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '7 days'
);

-- Policies
CREATE POLICY "Users can see shares sent to them" ON public.direct_shares
  FOR SELECT
  USING (auth.uid() = to_user_id OR auth.uid() = from_user_id);

CREATE POLICY "Users can create shares" ON public.direct_shares
  FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Recipient can mark as downloaded" ON public.direct_shares
  FOR UPDATE
  USING (auth.uid() = to_user_id);
```

#### 7. Create Storage Bucket
- Go to Storage in Supabase Console
- Create a bucket named `room-files`
- Set public access to **FALSE** (files accessed via signed URLs)

## 🎯 Features

### ✅ Core Functionality
1. **Create Share Rooms** - Users set custom rules for their rooms
2. **Room Rules** - Creator can define:
   - Maximum number of sharers
   - Maximum files per user
   - Maximum file size per upload
3. **Join Rooms** - Users join via room selection
4. **File Sharing** - Upload and download files with **zero quality loss**
5. **Real-time Updates** - See rooms, members, and files instantly

### 🛡️ Zero-Loss Guarantee
- Files are stored in their **original format** without any compression
- No transcoding or format conversion is applied
- Downloaded files are byte-identical to uploaded originals
- Perfect for images, videos, documents, and all file types

### 🌐 Cross-Platform
- Works on web browsers (Chrome, Firefox, Safari, Edge)
- Responsive design for desktop and mobile
- No app installation required
- Supports iOS Safari, Android Chrome, and all modern browsers

## 📁 Project Structure

```
ShareRoom/
├── public/                  # Static assets
├── src/
│   ├── components/          # React components
│   │   ├── RoomList.jsx
│   │   ├── RoomForm.jsx
│   │   ├── RoomDetails.jsx
│   │   └── StatusMessage.jsx
│   ├── utils/              # Utility functions
│   │   ├── supabase.js     # Supabase client
│   │   └── formatting.js   # Format helpers
│   ├── App.jsx             # Main application component
│   ├── main.jsx            # Entry point
│   └── index.css           # Global styles
├── index.html              # HTML template
├── vite.config.js          # Vite configuration
├── package.json            # Dependencies
└── .env.local              # Environment variables
```

## 🔧 How It Works

### User Flow
1. **Create Account** → Set display name (stored in browser)
2. **Create Room** → Define rules and settings
3. **Share Link** → Copy room link and share with others
4. **Join Room** → Other users join via the room selection
5. **Upload Files** → Users upload files (rules are enforced)
6. **Download Files** → Download with original quality

### Technical Flow
1. User creates room → Stores in `rooms` table
2. User joins room → Entry in `room_members` table
3. User uploads file → 
   - File stored in `room-files` bucket
   - Metadata saved in `room_files` table
4. User downloads file →
   - Generates signed URL (120 seconds validity)
   - Downloads original file

## 🔐 Environment Setup

### Supabase Credentials Location
Get your credentials from: **https://app.supabase.com**

1. Go to your project
2. Click "Settings" → "API"
3. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon/public key** → `VITE_SUPABASE_ANON_KEY`

### .env.local Format
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## 🎨 Design & UX

### Color Scheme
- **Primary:** Cyan (#06b6d4)
- **Secondary:** Amber (#f59e0b)
- **Dark:** Slate (#0f172a)
- **Background:** Cream/White with gradient

### Typography
- **Headings:** Space Grotesk (bold, modern)
- **Body:** Chivo (clean, readable)

### Layout
- Two-column desktop layout (create room + room list)
- Single column on mobile
- Responsive cards and forms
- Real-time status feedback

## 🚀 Deployment

### Deploy on Vercel (Recommended)
```bash
npm run build
# Push to GitHub
# Connect to Vercel and deploy
```

### Deploy on Netlify
1. Build project: `npm run build`
2. Connect GitHub repository
3. Set build command: `npm run build`
4. Set publish directory: `dist`
5. Add environment variables in Netlify dashboard

### Important: Environment Variables
When deploying, add these to your hosting platform:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 📝 Complete Supabase Integration Checklist

### Step 1: Create Tables (SQL)
- [ ] `rooms` table
- [ ] `room_members` table
- [ ] `room_files` table

### Step 2: Enable Storage
- [ ] Create `room-files` bucket
- [ ] Set bucket to private (access via signed URLs)

### Step 3: Configure Security
- [ ] Set RLS policies on tables (optional for MVP)
- [ ] Enable Supabase Auth (if needed)

### Step 4: Get Credentials
- [ ] Copy Project URL
- [ ] Copy Anon Key
- [ ] Add to `.env.local`

### Step 5: Test Connection
- [ ] Open app in browser
- [ ] Check Supabase status shows "Connected"
- [ ] Try creating a room

## 🐛 Troubleshooting

### "Supabase: Connected" shows as disconnected
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`
- Restart dev server: `npm run dev`
- Check browser console for errors

### Files not uploading
- Verify `room-files` bucket exists in Supabase Storage
- Check file size doesn't exceed room limit
- Ensure bucket is public for uploads or use appropriate RLS policies

### Rooms not appearing
- Verify `rooms` table and other tables exist
- Check your Supabase credentials
- Verify environment variables are loaded

## 🤝 Contributing

Feel free to extend ShareRoom with:
- End-to-end encryption
- Real-time collaboration
- File preview
- Bulk upload/download
- Advanced analytics
- Dark mode toggle

## 📄 License

This project is open source. Use and modify freely.

## 🎓 Learning Resources

- [Supabase Documentation](https://supabase.com/docs)
- [React Documentation](https://react.dev)
- [Vite Guide](https://vitejs.dev/guide)
- [Tailwind CSS](https://tailwindcss.com/docs)

---

**ShareRoom v1.0** - Built with ❤️ for seamless, zero-loss file sharing across all platforms.
