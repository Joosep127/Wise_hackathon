import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const rooms = sqliteTable("split_rooms", {
  id: text("id").primaryKey(),
  revision: integer("revision").notNull(),
  body: text("body").notNull(),
});
