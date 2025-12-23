import type { Express } from "express";
import { checkAuth, extractUser } from "../auth0Config";
import { storage } from "../storage";
import { z } from "zod";

const galleryFolderSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  driveUrl: z.string().url(),
  description: z.string().optional(),
  isPublic: z.boolean().default(true),
});

export function registerGalleryRoutes(app: Express) {
  // Get all gallery folders
  app.get('/api/gallery/folders', async (req, res) => {
    try {
      // For now, return empty array until we implement gallery folders in storage
      res.json([]);
    } catch (error) {
      console.error("Error fetching gallery folders:", error);
      res.status(500).json({ message: "Failed to fetch gallery folders" });
    }
  });

  // Create gallery folder (admin/committee only)
  app.post('/api/gallery/folders', checkAuth, async (req: any, res) => {
    try {
      const userInfo = extractUser(req);
      if (!userInfo) {
        return res.status(401).json({ message: "User not found" });
      }

      const user = await storage.getUser(userInfo.id);
      if (!user || (user.role !== 'admin' && !user.permissions?.gallery)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const folderData = galleryFolderSchema.parse(req.body);
      
      // For now, just return the folder data until we implement storage
      const galleryFolder = {
        id: Date.now(),
        ...folderData,
        createdBy: userInfo.id,
        createdAt: new Date().toISOString(),
      };

      res.json(galleryFolder);
    } catch (error) {
      console.error("Error creating gallery folder:", error);
      res.status(500).json({ message: "Failed to create gallery folder" });
    }
  });
}