import { relations } from "drizzle-orm";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
  projects,
  tours,
  scenes,
  panoramaImages,
  hotspots,
  floorplans,
  floorplanMarkers,
  embedSettings,
  brandingSettings,
  analyticsEvents,
} from "./schema";

export const usersRelations = relations(users, ({ many, one }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  projects: many(projects),
  brandingSettings: one(brandingSettings, {
    fields: [users.id],
    references: [brandingSettings.ownerId],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const verificationTokensRelations = relations(verificationTokens, () => ({}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, { fields: [projects.ownerId], references: [users.id] }),
  tours: many(tours),
}));

export const toursRelations = relations(tours, ({ one, many }) => ({
  project: one(projects, { fields: [tours.projectId], references: [projects.id] }),
  scenes: many(scenes),
  floorplans: many(floorplans),
  embedSettings: one(embedSettings, {
    fields: [tours.id],
    references: [embedSettings.tourId],
  }),
  analyticsEvents: many(analyticsEvents),
}));

export const scenesRelations = relations(scenes, ({ one, many }) => ({
  tour: one(tours, { fields: [scenes.tourId], references: [tours.id] }),
  panoramaImage: one(panoramaImages, {
    fields: [scenes.id],
    references: [panoramaImages.sceneId],
  }),
  hotspots: many(hotspots),
  floorplanMarkers: many(floorplanMarkers),
}));

export const panoramaImagesRelations = relations(panoramaImages, ({ one }) => ({
  scene: one(scenes, {
    fields: [panoramaImages.sceneId],
    references: [scenes.id],
  }),
}));

export const hotspotsRelations = relations(hotspots, ({ one }) => ({
  scene: one(scenes, { fields: [hotspots.sceneId], references: [scenes.id] }),
}));

export const floorplansRelations = relations(floorplans, ({ one, many }) => ({
  tour: one(tours, { fields: [floorplans.tourId], references: [tours.id] }),
  markers: many(floorplanMarkers),
}));

export const floorplanMarkersRelations = relations(floorplanMarkers, ({ one }) => ({
  floorplan: one(floorplans, {
    fields: [floorplanMarkers.floorplanId],
    references: [floorplans.id],
  }),
  scene: one(scenes, {
    fields: [floorplanMarkers.sceneId],
    references: [scenes.id],
  }),
}));

export const embedSettingsRelations = relations(embedSettings, ({ one }) => ({
  tour: one(tours, { fields: [embedSettings.tourId], references: [tours.id] }),
}));

export const brandingSettingsRelations = relations(brandingSettings, ({ one }) => ({
  owner: one(users, {
    fields: [brandingSettings.ownerId],
    references: [users.id],
  }),
}));

export const analyticsEventsRelations = relations(analyticsEvents, ({ one }) => ({
  tour: one(tours, { fields: [analyticsEvents.tourId], references: [tours.id] }),
  scene: one(scenes, {
    fields: [analyticsEvents.sceneId],
    references: [scenes.id],
  }),
}));
