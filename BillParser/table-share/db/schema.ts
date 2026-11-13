import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const rooms = sqliteTable("split_rooms", {
  id: text("id").primaryKey(),
  revision: integer("revision").notNull(),
  body: text("body").notNull(),
});

export const presence = sqliteTable("split_presence", {
  roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  personId: text("person_id").notNull(),
  lastSeen: integer("last_seen").notNull(),
}, table => [primaryKey({ columns: [table.roomId, table.personId] })]);
