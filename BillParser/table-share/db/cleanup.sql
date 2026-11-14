-- Presence is temporary: inactive viewers are already hidden after 30 seconds.
-- Keep all bills, participants, selections and payment history.
DELETE FROM split_presence
WHERE last_seen < unixepoch() - 30
   OR NOT EXISTS (SELECT 1 FROM split_rooms WHERE split_rooms.id = split_presence.room_id);
PRAGMA optimize;
