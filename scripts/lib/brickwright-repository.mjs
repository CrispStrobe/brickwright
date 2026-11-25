import assert from 'node:assert/strict';

export const BRICKWRIGHT_REPOSITORY_ID = 1291854269;
export const BRICKWRIGHT_PREVIOUS_SLUG = 'CrispStrobe/brickwright-lite';
export const BRICKWRIGHT_SLUG = 'CrispStrobe/brickwright';

export function assertBrickwrightSlug(repository) {
    assert.ok([BRICKWRIGHT_PREVIOUS_SLUG, BRICKWRIGHT_SLUG].includes(repository),
        'Only the owned Brickwright repository is admitted');
}

export function assertBrickwrightRepository(repository, repositoryId) {
    assertBrickwrightSlug(repository);
    // The final slug also identifies the legacy repository before cutover.
    // Older evidence under the previous slug did not carry this field.
    if (repository === BRICKWRIGHT_SLUG || repositoryId !== undefined) {
        assert.equal(Number(repositoryId), BRICKWRIGHT_REPOSITORY_ID, 'Owned Brickwright repository ID required');
    }
}
