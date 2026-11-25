// app/lib/search/bitParallelSearch.js
/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║ IKY-BitParallelEngine: Myers' 64-bit Bit-Vector Parallel Fuzzy Search    ║
 * ║ High-performance approximate string matching for Fleet Devices & Users    ║
 * ║ - Word-level parallelism using BigInt 64-bit bitmasks                      ║
 * ║ - O(1) state transitions per character instead of O(m*n) DP matrix       ║
 * ║ - Vietnamese diacritic folding & vehicle license plate canonicalization  ║
 * ║ - Tolerates typos, transposed characters, prefix & partial matches        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

/**
 * Normalizes Vietnamese diacritics and special characters to base ASCII
 */
export const normalizeVietnameseSearchText = (inputText = '') => {
    if (!inputText) return '';
    return String(inputText)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .toLowerCase()
        .trim();
};

/**
 * Canonicalizes vehicle license plates and device IMEIs by stripping separators
 */
export const canonicalizeVehicleSearchKey = (inputText = '') => {
    if (!inputText) return '';
    return normalizeVietnameseSearchText(inputText).replace(/[\s\.\-_:\/]/g, '');
};

/**
 * Precomputes character bitmasks for pattern characters
 */
const buildPatternCharacterBitmasks = (patternString) => {
    const characterBitmasks = new Map();
    const patternLength = patternString.length;

    for (let characterIndex = 0; characterIndex < patternLength; characterIndex++) {
        const currentCharacter = patternString[characterIndex];
        const existingMask = characterBitmasks.get(currentCharacter) || 0n;
        const bitPosition = 1n << BigInt(characterIndex);
        characterBitmasks.set(currentCharacter, existingMask | bitPosition);
    }

    return characterBitmasks;
};

/**
 * Myers' 64-bit Bit-Vector Parallel Approximate Search
 * Calculates minimum edit distance between pattern and any substring of targetText
 */
export const calculateMyersBitParallelDistance = (searchPattern, targetText, maxAllowedErrors = 2) => {
    if (!searchPattern || !targetText) return Infinity;

    const patternLength = searchPattern.length;
    const textLength = targetText.length;

    if (patternLength === 0) return 0;
    if (patternLength > 64) {
        return targetText.includes(searchPattern) ? 0 : Infinity;
    }

    if (targetText.includes(searchPattern)) return 0;

    const characterBitmasks = buildPatternCharacterBitmasks(searchPattern);
    const patternHighestBitMask = 1n << BigInt(patternLength - 1);

    // Initial bit vectors: positiveVertical is set to all 1s up to patternLength
    let positiveVerticalVector = (1n << BigInt(patternLength)) - 1n;
    let negativeVerticalVector = 0n;
    let currentEditDistance = patternLength;
    let minimumEditDistanceFound = patternLength;

    for (let textIndex = 0; textIndex < textLength; textIndex++) {
        const currentTextCharacter = targetText[textIndex];
        const matchingCharacterBitmask = characterBitmasks.get(currentTextCharacter) || 0n;

        const verticalMatchUnion = matchingCharacterBitmask | negativeVerticalVector;
        const carryAdditionResult =
            (((matchingCharacterBitmask & positiveVerticalVector) + positiveVerticalVector) ^
                positiveVerticalVector) |
            matchingCharacterBitmask;

        let positiveHorizontalVector = negativeVerticalVector | ~(carryAdditionResult | positiveVerticalVector);
        let negativeHorizontalVector = positiveVerticalVector & carryAdditionResult;

        if ((positiveHorizontalVector & patternHighestBitMask) !== 0n) {
            currentEditDistance += 1;
        } else if ((negativeHorizontalVector & patternHighestBitMask) !== 0n) {
            currentEditDistance -= 1;
        }

        if (currentEditDistance < minimumEditDistanceFound) {
            minimumEditDistanceFound = currentEditDistance;
        }

        positiveHorizontalVector = (positiveHorizontalVector << 1n) | 1n;
        negativeHorizontalVector = negativeHorizontalVector << 1n;

        positiveVerticalVector = negativeHorizontalVector | ~(verticalMatchUnion | positiveHorizontalVector);
        negativeVerticalVector = positiveHorizontalVector & verticalMatchUnion;
    }

    return minimumEditDistanceFound <= maxAllowedErrors ? minimumEditDistanceFound : Infinity;
};

/**
 * Evaluates match quality between a search query and a single target string
 * Returns match score (0 = no match, 100 = exact match)
 */
export const evaluateFuzzyMatchScore = (rawQuery, rawTarget) => {
    if (!rawQuery || !rawTarget) return 0;

    const normalizedQuery = normalizeVietnameseSearchText(rawQuery);
    const normalizedTarget = normalizeVietnameseSearchText(rawTarget);

    if (normalizedQuery === normalizedTarget) return 100;
    if (normalizedTarget.startsWith(normalizedQuery)) return 95;
    if (normalizedTarget.includes(normalizedQuery)) return 90;

    // Canonicalized comparison (ignoring spaces, dashes, dots for license plates & IMEIs)
    const canonicalQuery = canonicalizeVehicleSearchKey(rawQuery);
    const canonicalTarget = canonicalizeVehicleSearchKey(rawTarget);

    if (canonicalTarget.startsWith(canonicalQuery)) return 88;
    if (canonicalTarget.includes(canonicalQuery)) return 85;

    // If query is short (< 3 chars), do not trigger approximate edit distance
    if (canonicalQuery.length < 3) return 0;

    const maxAllowedErrors = canonicalQuery.length <= 4 ? 1 : 2;
    const computedEditDistance = calculateMyersBitParallelDistance(
        canonicalQuery,
        canonicalTarget,
        maxAllowedErrors
    );

    if (computedEditDistance === 0) return 85;
    if (computedEditDistance === 1) return 70;
    if (computedEditDistance === 2) return 50;

    return 0;
};

/**
 * Searches and ranks an array of record items across multiple specified fields
 */
export const searchAndRankRecords = (recordList = [], searchQuery = '', targetSearchFields = []) => {
    if (!searchQuery || !searchQuery.trim() || !recordList.length) {
        return recordList;
    }

    const trimmedQuery = searchQuery.trim();
    const scoredRecordResults = [];

    for (let recordIndex = 0; recordIndex < recordList.length; recordIndex++) {
        const currentRecord = recordList[recordIndex];
        let maximumFieldScore = 0;

        for (let fieldIndex = 0; fieldIndex < targetSearchFields.length; fieldIndex++) {
            const fieldKey = targetSearchFields[fieldIndex];
            const targetFieldValue = currentRecord?.[fieldKey];
            if (targetFieldValue == null) continue;

            const fieldScore = evaluateFuzzyMatchScore(trimmedQuery, String(targetFieldValue));
            if (fieldScore > maximumFieldScore) {
                maximumFieldScore = fieldScore;
            }
        }

        if (maximumFieldScore > 0) {
            scoredRecordResults.push({
                record: currentRecord,
                matchScore: maximumFieldScore,
                originalIndex: recordIndex,
            });
        }
    }

    // Sort by descending match score, then preserve original order
    scoredRecordResults.sort((firstItem, secondItem) => {
        if (secondItem.matchScore !== firstItem.matchScore) {
            return secondItem.matchScore - firstItem.matchScore;
        }
        return firstItem.originalIndex - secondItem.originalIndex;
    });

    return scoredRecordResults.map((item) => item.record);
};
