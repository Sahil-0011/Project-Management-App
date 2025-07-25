import "dotenv/config";
import mongoose from "mongoose";
import connectDatabase from "../config/database.config";
import RoleModel from "../models/roles-permission.model";
import { RolePermissions } from "../utils/role-permission";
import { exit } from "process";

const seedRoles = async () => {
  console.log("🚀 Starting role seeding...");

  try {
    await connectDatabase();

    const roles = Object.entries(RolePermissions).map(([name, permissions]) => ({
      name,
      permissions
    }));

    console.log("🧹 Clearing existing roles...");
    await RoleModel.deleteMany({});

    console.log("🌱 Seeding new roles...");
    const result = await RoleModel.insertMany(roles);
    
    console.log("✅ Successfully seeded roles:");
    result.forEach(role => {
      console.log(`- ${role.name}: ${role.permissions.join(', ')}`);
    });

    exit(0);
  } catch (error) {
    console.error("❌ Error seeding roles:", error);
    exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

seedRoles();