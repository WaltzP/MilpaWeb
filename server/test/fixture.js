import { registrationService } from '../registration.js';

export function fixture() {
  const documents = new Map(), users = new Map(), codes = [], updates = [], tokens = new Map(), verifications = [];
  let clock = 1800000000000, tail = Promise.resolve(), counter = 0, mailError;
  const db = {
    collection: collection => ({ doc: id => ({ path: `${collection}/${id}` }) }),
    runTransaction(action) {
      const task = tail.then(async () => {
        const pending = new Map();
        const result = await action({
          get: async ref => ({ data: () => structuredClone(documents.get(ref.path)) }),
          set: (ref, value) => pending.set(ref.path, structuredClone(value)),
        });
        for (const [key, value] of pending) documents.set(key, value);
        return result;
      });
      tail = task.catch(() => {}); return task;
    },
  };
  const auth = {
    async createUser(data) {
      if ([...users.values()].some(user => user.email === data.email)) throw Object.assign(new Error(), { code: 'auth/email-already-exists' });
      const user = { ...data, uid: `user-${++counter}`, disabled: false, tokensValidAfterTime: 'initial', customClaims: {} };
      users.set(user.uid, user); return { ...user };
    },
    async getUser(uid) { return structuredClone(users.get(uid)); },
    async updateUser(uid, data) { updates.push({ uid, data }); Object.assign(users.get(uid), data); return this.getUser(uid); },
    async createCustomToken(uid, claims) { return JSON.stringify({ uid, claims }); },
    async verifyIdToken(value, revoked) {
      verifications.push({ value, revoked });
      if (!tokens.has(value)) throw new Error('invalid'); return tokens.get(value);
    },
  };
  const makeService = () => registrationService({ auth, db, secret: 'test-registration-secret-at-least-32-characters', now: () => clock, sendCode: async (email, code) => { codes.push({ email, code }); if (mailError) throw mailError; } });
  return { db, auth, service: makeService(), makeService, documents, users, codes, updates, tokens, verifications,
    advance: milliseconds => { clock += milliseconds; }, failMail: error => { mailError = error; },
    values: { email: 'Ana@Example.test', password: 'ValidPassword123', confirmPassword: 'ValidPassword123' },
    record: () => [...documents.entries()].find(([key]) => key.startsWith('websiteRegistrationChallenges/'))?.[1],
  };
}
