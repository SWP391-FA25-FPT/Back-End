import mongoose from 'mongoose';
import Recipe from '../models/Recipe.js';
import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

// Default tag to add if recipe has no tags
const DEFAULT_TAG = 'Khác';

// Migration function
const migrateRecipeTags = async () => {
  try {
    console.log('Starting migration: Adding default tags to recipes without tags...\n');

    // Find all recipes that have no tags or empty tags array
    const recipesWithoutTags = await Recipe.find({
      $or: [
        { tags: { $exists: false } },
        { tags: null },
        { tags: [] }
      ]
    });

    console.log(`Found ${recipesWithoutTags.length} recipes without tags`);

    if (recipesWithoutTags.length === 0) {
      console.log('No recipes need migration. Exiting...');
      await mongoose.connection.close();
      return;
    }

    let updatedCount = 0;
    let skippedCount = 0;

    for (const recipe of recipesWithoutTags) {
      try {
        // Add default tag
        recipe.tags = [DEFAULT_TAG];
        await recipe.save();
        updatedCount++;
        console.log(`✓ Updated recipe: ${recipe.name || recipe._id} - Added tag: "${DEFAULT_TAG}"`);
      } catch (error) {
        skippedCount++;
        console.error(`✗ Failed to update recipe ${recipe._id}:`, error.message);
      }
    }

    console.log('\n=== Migration Summary ===');
    console.log(`Total recipes found: ${recipesWithoutTags.length}`);
    console.log(`Successfully updated: ${updatedCount}`);
    console.log(`Failed/Skipped: ${skippedCount}`);
    console.log('\nMigration completed!');

  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  }
};

// Run migration
const runMigration = async () => {
  await connectDB();
  await migrateRecipeTags();
};

// Execute
runMigration();

