CREATE TABLE `admin_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`group_name` text,
	`auth_user_id` text,
	`invited_by` text,
	`is_active` integer DEFAULT true NOT NULL,
	`invited_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`activated_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "admin_users_role_check" CHECK("admin_users"."role" in ('admin','member'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_users_email_unique` ON `admin_users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `admin_users_auth_user_id_unique` ON `admin_users` (`auth_user_id`);--> statement-breakpoint
CREATE INDEX `idx_admin_users_role_group` ON `admin_users` (`role`,`group_name`);--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`expires_at` integer,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_account_provider` ON `account` (`provider_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`name` text,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `check_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`model_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`api_key` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`is_maintenance` integer DEFAULT false NOT NULL,
	`group_name` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`model_id`) REFERENCES `check_models`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_check_configs_model_id` ON `check_configs` (`model_id`);--> statement-breakpoint
CREATE TABLE `check_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`config_id` text NOT NULL,
	`status` text NOT NULL,
	`latency_ms` integer,
	`ping_latency_ms` real,
	`checked_at` integer NOT NULL,
	`message` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`config_id`) REFERENCES `check_configs`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "check_status_valid" CHECK("check_history"."status" in ('operational','degraded','failed','validation_failed','error')),
	CONSTRAINT "check_latency_positive" CHECK("check_history"."latency_ms" is null or "check_history"."latency_ms" >= 0)
);
--> statement-breakpoint
CREATE INDEX `idx_check_history_config_id` ON `check_history` (`config_id`);--> statement-breakpoint
CREATE INDEX `idx_check_history_checked_at` ON `check_history` (`checked_at`);--> statement-breakpoint
CREATE INDEX `idx_history_config_checked` ON `check_history` (`config_id`,`checked_at`);--> statement-breakpoint
CREATE TABLE `check_models` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`model` text NOT NULL,
	`template_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `check_request_templates`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `check_models_type_model` ON `check_models` (`type`,`model`);--> statement-breakpoint
CREATE TABLE `check_request_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`request_header` text,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `check_request_templates_name_unique` ON `check_request_templates` (`name`);--> statement-breakpoint
CREATE TABLE `group_info` (
	`id` text PRIMARY KEY NOT NULL,
	`group_name` text NOT NULL,
	`website_url` text,
	`tags` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_info_group_name_unique` ON `group_info` (`group_name`);--> statement-breakpoint
CREATE TABLE `system_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`message` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`level` text DEFAULT 'info' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
