import { db, bookCache } from '../lib/db';
import { sql } from 'drizzle-orm';
import { logger } from '../lib/utils/logger';

function capitalizeName(name: string): string {
  return name
    .split(' ')
    .filter(word => word.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

async function main() {
  logger.info('Starting one-time database cleanup for mangled author names in bookCache...');

  // Fetch all records
  const records = await db.select().from(bookCache);
  logger.info(`Found ${records.length} total records in bookCache.`);

  let repairedCount = 0;

  for (const record of records) {
    if (!record.author || !record.title) continue;

    const originalTitle = record.title;
    const originalAuthor = record.author;

    // Detect if the title starts with a lowercase letter, which is the strongest indicator
    // of a mangled name fragment that was prepended to the title.
    const firstChar = originalTitle.charAt(0);
    const isMangled = firstChar === firstChar.toLowerCase() && firstChar !== firstChar.toUpperCase();

    // Check for some known fragments that might be capitalized
    const knownCapitalizedFragments = ['St. John', 'St.', 'Jenkins'];
    let hasCapitalizedFragment = false;
    let fragmentToMove = '';

    for (const fragment of knownCapitalizedFragments) {
        if (originalTitle.startsWith(fragment + ' ')) {
            hasCapitalizedFragment = true;
            fragmentToMove = fragment;
            break;
        }
    }

    // Handle the "qntm" repair: single-name author with title appended to author string (no comma)
    // e.g., author: "qntm Ra", title: "ra"
    // To do this safely and case-insensitively, we check if originalAuthor ends with originalTitle.
    let isSingleNameMangled = false;
    let singleNameAuthorRepaired = '';

    // Check if the author ends with the title (case-insensitive) preceded by a space
    if (originalAuthor.toLowerCase().endsWith(' ' + originalTitle.toLowerCase())) {
        isSingleNameMangled = true;
        // Strip the title from the end of the author string
        singleNameAuthorRepaired = originalAuthor.substring(0, originalAuthor.length - (originalTitle.length + 1));
    }

    if (isMangled || hasCapitalizedFragment || isSingleNameMangled) {
      let newTitle = '';
      let newAuthor = '';

      if (isSingleNameMangled) {
          newAuthor = singleNameAuthorRepaired;
          newTitle = originalTitle; // Keep title as is
          // Note: for "qntm", we probably don't want to capitalize the name automatically if the user expects "qntm",
          // but if we do want to, the original script does it later. Wait, we should probably not capitalize it to preserve the original capitalization or use capitalizeName. Let's look at how the other branches handle it.
      } else if (isMangled) {
          // Find the first space to extract the fragment
          // Wait, for "st. john Exit Party", the fragment is "st. john".
          // If we just look at the old logic:
          // firstNameRaw was first word of remainder.
          // Everything else was titleRaw.
          // So the fragment in the title might be multiple words if the middle name had spaces AND they were lowercase?
          // Actually, "mandel, emily st. john Exit Party" -> spaceIndex was after "emily".
          // So titleRaw became "st. john Exit Party".
          // We can find where the first capital letter starts in the title to isolate the true title.
          const words = originalTitle.split(' ');
          const titleWords = [];
          const fragmentWords = [];

          let titleStarted = false;
          for (const word of words) {
              if (!titleStarted && (word.charAt(0) === word.charAt(0).toUpperCase() && word.charAt(0) !== word.charAt(0).toLowerCase())) {
                  // Wait, "st. john" -> "st." is lower, "john" is lower.
                  // "jenkins Atmosphere" -> "jenkins" is lower, "Atmosphere" is upper.
                  // So we can assume the title starts at the first capitalized word.
                  titleStarted = true;
              }

              if (titleStarted) {
                  titleWords.push(word);
              } else {
                  fragmentWords.push(word);
              }
          }

          if (fragmentWords.length > 0 && titleWords.length > 0) {
              fragmentToMove = fragmentWords.join(' ');
              newTitle = titleWords.join(' ');
          } else {
              // If we couldn't separate it nicely, skip to avoid making it worse
              continue;
          }
      } else if (hasCapitalizedFragment) {
          newTitle = originalTitle.substring(fragmentToMove.length + 1);
      }

      if (isSingleNameMangled && newTitle && newAuthor) {
          await db.update(bookCache)
              .set({
                  title: newTitle,
                  author: newAuthor
              })
              .where(sql`id = ${record.id}`);
          repairedCount++;
          logger.info(`Repaired: "${originalAuthor}" / "${originalTitle}"  ->  "${newAuthor}" / "${newTitle}"`);
      } else if (fragmentToMove && newTitle) {
          // Reconstruct the author
          // Original author was e.g. "Emily Mandel". We want "Emily St. John Mandel".
          // The old logic took the first word of remainder as firstName, and lastName.
          // We can split author by space. First word is first name, last is last name.
          const authorParts = originalAuthor.split(' ');
          if (authorParts.length >= 2) {
              const firstName = authorParts[0];
              const lastName = authorParts.slice(1).join(' '); // In case last name had spaces

              newAuthor = capitalizeName(`${firstName} ${fragmentToMove} ${lastName}`);

              // Update the database
              await db.update(bookCache)
                  .set({
                      title: newTitle,
                      author: newAuthor
                  })
                  .where(sql`id = ${record.id}`);

              repairedCount++;
              logger.info(`Repaired: "${originalAuthor}" / "${originalTitle}"  ->  "${newAuthor}" / "${newTitle}"`);
          }
      }
    }
  }

  logger.info(`Finished processing records.`, { totalProcessed: records.length, successfullyRepaired: repairedCount });
}

main().catch(error => {
  logger.error('Error during cleanup', { error: error instanceof Error ? error.message : error });
});
