import { Type, type FunctionDeclaration, type Tool } from '@google/genai'

// Gemini Live function declarations (Story 1.5). The model calls these mid-conversation as it extracts
// information from the coded questions in persona.ts — each call is handled immediately (Epic 3.2/3.3), not
// batched until the end.

export const REPORT_SITUATION: FunctionDeclaration = {
  name: 'report_situation',
  description: 'Report any newly learned or updated details about the caller\'s situation. Call this as soon as you learn something, even partial — do not wait for the full picture.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      peopleCount: { type: Type.INTEGER, description: 'Number of people present, if known' },
      dangerIndicators: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Short tags for the NEW danger signals learned from the latest answer only — earlier tags are kept automatically, so do not resend them. Give each distinct fact its own specific tag, e.g. "weapon: knife", "attacker still present", "victim injured - bleeding", "attacker on scooter", "child involved", "3+ people involved".',
      },
      urgency: { type: Type.STRING, enum: ['low', 'medium', 'high'], description: 'How urgent the situation seems' },
      notes: { type: Type.STRING, description: 'Any other free-form detail worth passing to a responder' },
    },
  },
}

export const CONFIRM_ADDRESS: FunctionDeclaration = {
  name: 'confirm_address',
  description: 'Call this the moment the caller states their delivery address.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      address: { type: Type.STRING, description: 'The address exactly as the caller said it' },
    },
    required: ['address'],
  },
}

export const REPORT_STRESS_LEVEL: FunctionDeclaration = {
  name: 'report_stress_level',
  description: 'Report your current estimate of the caller\'s vocal stress/duress from tone, pace and pitch. Call periodically through the call, roughly every 15-20 seconds, independent of what is being said.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      score: { type: Type.NUMBER, description: '0-100 estimate, higher means more stressed/under duress' },
    },
    required: ['score'],
  },
}

export const END_CALL: FunctionDeclaration = {
  name: 'end_call',
  description: 'Call this the moment you finish your closing line (e.g. "your order\'s on its way, thanks for calling") — after the caller has confirmed they\'re done, whether that means they gave a clear closing signal or you\'ve gathered what you reasonably can. This actually ends the call, so only call it once you are done speaking.',
  parameters: { type: Type.OBJECT, properties: {} },
}

export const LIVE_CALL_TOOLS: Tool[] = [{ functionDeclarations: [REPORT_SITUATION, CONFIRM_ADDRESS, REPORT_STRESS_LEVEL, END_CALL] }]
