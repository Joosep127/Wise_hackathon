CREATE TABLE `split_presence` (
	`room_id` text NOT NULL,
	`person_id` text NOT NULL,
	`last_seen` integer NOT NULL,
	PRIMARY KEY(`room_id`, `person_id`),
	FOREIGN KEY (`room_id`) REFERENCES `split_rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
