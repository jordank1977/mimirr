-- Create notification_settings table for Discord configuration
CREATE TABLE IF NOT EXISTS notification_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_enabled INTEGER DEFAULT 0 NOT NULL,
  discord_webhook_url TEXT,
  discord_bot_username TEXT DEFAULT 'Mimirr',
  discord_bot_avatar_url TEXT,
  notify_request_approved INTEGER DEFAULT 1 NOT NULL,
  notify_request_declined INTEGER DEFAULT 1 NOT NULL,
  notify_request_available INTEGER DEFAULT 1 NOT NULL,
  notify_request_submitted INTEGER DEFAULT 1 NOT NULL,
  notify_bookshelf_error INTEGER DEFAULT 1 NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
  updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
);

-- Insert default settings row (only one row should ever exist)
INSERT INTO notification_settings (id) VALUES (1);

-- Create notifications table for in-app notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL, -- 'request_approved', 'request_declined', 'request_available', 'request_submitted', 'bookshelf_error'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT, -- Optional link to relevant page (e.g., /requests)
  is_read INTEGER DEFAULT 0 NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
