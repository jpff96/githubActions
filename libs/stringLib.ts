import { safeTrim } from '@eclipsetechnology/eclipse-api-helpers';

/**
 * Converts a "CamelCase" text into "Camel Case"
 * @param text Original text to be converted (must be a "CamelCase" text)
 */
export const camelCaseToHumanCase = (text: string): string => (safeTrim(text).match(/[A-Z][a-z]+/g) || []).join(' ');
