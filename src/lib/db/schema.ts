import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  real,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

// Auth.js / NextAuth v5 compatible schema
export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  // App-specific fields
  passwordHash: text("password_hash"),
  plan: text("plan", { enum: ["free", "starter", "pro", "agency"] })
    .default("free")
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const accounts = pgTable("accounts", {
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
});

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: text("owner_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tours = pgTable("tours", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  status: text("status", { enum: ["draft", "published", "archived"] })
    .default("draft")
    .notNull(),
  startSceneId: uuid("start_scene_id"),
  password: text("password"),
  allowedDomains: text("allowed_domains").array(),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const scenes = pgTable("scenes", {
  id: uuid("id").primaryKey().defaultRandom(),
  tourId: uuid("tour_id")
    .references(() => tours.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  order: integer("order").default(0).notNull(),
  initialYaw: real("initial_yaw").default(0),
  initialPitch: real("initial_pitch").default(0),
  ambientAudio: text("ambient_audio_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const panoramaImages = pgTable("panorama_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  sceneId: uuid("scene_id")
    .references(() => scenes.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  storageKey: text("storage_key").notNull(),
  url: text("url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  width: integer("width"),
  height: integer("height"),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const hotspots = pgTable("hotspots", {
  id: uuid("id").primaryKey().defaultRandom(),
  sceneId: uuid("scene_id")
    .references(() => scenes.id, { onDelete: "cascade" })
    .notNull(),
  type: text("type", {
    enum: ["scene_link", "info_text", "url_link", "image", "video"],
  }).notNull(),
  pitch: real("pitch").notNull(),
  yaw: real("yaw").notNull(),
  label: text("label"),
  iconType: text("icon_type").default("arrow"),
  iconColor: text("icon_color").default("#ffffff"),
  content: jsonb("content").notNull(),
  order: integer("order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const floorplans = pgTable("floorplans", {
  id: uuid("id").primaryKey().defaultRandom(),
  tourId: uuid("tour_id")
    .references(() => tours.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  imageUrl: text("image_url").notNull(),
  storageKey: text("storage_key").notNull(),
  order: integer("order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const floorplanMarkers = pgTable("floorplan_markers", {
  id: uuid("id").primaryKey().defaultRandom(),
  floorplanId: uuid("floorplan_id")
    .references(() => floorplans.id, { onDelete: "cascade" })
    .notNull(),
  sceneId: uuid("scene_id")
    .references(() => scenes.id)
    .notNull(),
  xPercent: real("x_percent").notNull(),
  yPercent: real("y_percent").notNull(),
  label: text("label"),
});

export const embedSettings = pgTable("embed_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  tourId: uuid("tour_id")
    .references(() => tours.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  defaultWidth: text("default_width").default("100%"),
  defaultHeight: text("default_height").default("600px"),
  showControls: boolean("show_controls").default(true),
  showTitle: boolean("show_title").default(true),
  showFullscreen: boolean("show_fullscreen").default(true),
  autoRotate: boolean("auto_rotate").default(false),
  autoRotateSpeed: real("auto_rotate_speed").default(1),
  gyroEnabled: boolean("gyro_enabled").default(true),
});

export const brandingSettings = pgTable("branding_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").default("#3b82f6"),
  showPoweredBy: boolean("show_powered_by").default(true),
  customCss: text("custom_css"),
});

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tourId: uuid("tour_id")
      .references(() => tours.id)
      .notNull(),
    sceneId: uuid("scene_id").references(() => scenes.id),
    hotspotId: uuid("hotspot_id").references(() => hotspots.id, { onDelete: "set null" }),
    eventType: text("event_type", {
      enum: ["tour_view", "scene_view", "hotspot_click", "tour_complete"],
    }).notNull(),
    sessionId: text("session_id"),
    deviceType: text("device_type"),
    country: text("country"),
    referrer: text("referrer"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("analytics_tour_id_idx").on(t.tourId),
    index("analytics_created_at_idx").on(t.createdAt),
  ]
);

export type DbUser = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type DbProject = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type DbTour = typeof tours.$inferSelect;
export type NewTour = typeof tours.$inferInsert;
export type DbScene = typeof scenes.$inferSelect;
export type NewScene = typeof scenes.$inferInsert;
export type DbPanoramaImage = typeof panoramaImages.$inferSelect;
export type DbHotspot = typeof hotspots.$inferSelect;
export type DbEmbedSettings = typeof embedSettings.$inferSelect;
export type DbBrandingSettings = typeof brandingSettings.$inferSelect;
