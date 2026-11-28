// Interviewer-only material for system design topics. Keep this file server-side:
// it is the answer key, so it must never be imported by client components.
// Keys match the topic IDs in src/lib/data/system-design.ts.

export interface SystemDesignInterviewerNotes {
  /** Facts the interviewer states only when the candidate asks about that dimension. */
  facts: {topic: string; answer: string}[];
  /** Things the interviewer has no fixed answer for; the candidate chooses a working assumption. */
  candidateChooses: string[];
  /** Expected estimates, used to check the candidate's math. Never volunteered. */
  estimates: string[];
  /** Areas worth probing after the high-level design, chosen to fit the candidate's design. */
  deepDives: string[];
  /** Mistakes to listen for. Probe with a concrete scenario instead of naming the mistake. */
  pitfalls: string[];
  /** Constraint changes to introduce, one at a time, after the candidate finishes. */
  changedConstraints: string[];
}

// URL shortener requirements use "System Design Interview" (Alex Xu, vol. 1, ch. 8) as a reference,
// restated in our own words. The book's design is one valid answer among many; the deep dives
// below deliberately list several approaches so the interviewer does not expect the book's.
const urlShortener: SystemDesignInterviewerNotes = {
  facts: [
    {topic: "Example behavior", answer: "A long URL such as https://shop.example.com/products/item?id=48213&ref=newsletter&utm_campaign=spring gets a short alias such as https://short.ly/aB3kQ9x. Opening the alias redirects to the original URL."},
    {topic: "Core use cases", answer: "Two: shorten a long URL into a short one, and redirect a short URL to its original long URL."},
    {topic: "Write traffic", answer: "100 million new short URLs are created per day."},
    {topic: "Read traffic", answer: "Redirects outnumber creations about 10 to 1."},
    {topic: "Short URL length", answer: "As short as possible."},
    {topic: "Allowed characters", answer: "Digits 0-9, lowercase a-z and uppercase A-Z only."},
    {topic: "Deleting or editing links", answer: "Not supported. Once created, a short URL is permanent and cannot be changed."},
    {topic: "Retention", answer: "The service must keep working for 10 years, and links stay valid for that whole period."},
    {topic: "Average long URL size", answer: "About 100 bytes."},
    {topic: "Non-functional requirements", answer: "The service must be highly available, scalable and fault tolerant. Redirects are user-facing, so they should be fast."},
    {topic: "Users and accounts", answer: "Anonymous use is fine. No accounts, custom aliases or link analytics are required for the initial design."},
  ],
  candidateChooses: [
    "Peak-to-average traffic ratio",
    "Whether submitting the same long URL twice returns the existing short URL or creates a new one",
    "Exact latency targets and cache hit rate",
    "Which database, cache or ID-generation technology to use",
  ],
  estimates: [
    "Writes: 100M / 86,400 s is about 1,160 per second on average.",
    "Reads: 10x writes is about 11,600 redirects per second on average; peak is higher by whatever factor the candidate assumes.",
    "Records: 100M x 365 x 10 years is about 365 billion short URLs.",
    "Storage: 365 billion x ~100 bytes is about 36.5 TB of long URLs before indexes, replication and metadata. Accept a reasonable order of magnitude if the reasoning is sound.",
    "Code length: with 62 characters, 62^6 is about 56.8 billion (too few) and 62^7 is about 3.5 trillion (enough), so 7 characters.",
  ],
  deepDives: [
    "Short code generation: how codes are produced and kept unique. Valid approaches include hashing the long URL and truncating, base-62 encoding a unique numeric ID, random codes with a uniqueness check, or a pool of pre-generated keys. Probe whichever they chose: collisions, predictability, and whether the same long URL maps to the same code.",
    "Uniqueness under concurrency: for hash or random codes, what happens on a collision and what each existence check costs on the write path (and whether something like a Bloom filter helps, with its false positives). For ID or key-pool approaches, how IDs or keys stay unique across many servers and what happens when that service fails.",
    "Redirect path: 301 (permanent, browsers cache it, less load) versus 302 (temporary, every click reaches the service, needed for click tracking), and the consequence of each.",
    "Read scaling: caching short-to-long mappings for a 10:1 read-heavy workload, hot links that go viral, cache misses for unknown codes, and what happens when the cache is cold or down.",
    "Data model and storage: the short URL to long URL table, which lookups need indexes (by short code, and by long URL if deduplicating), and how to shard about 365 billion rows across machines.",
    "Abuse: one client flooding the shorten endpoint, rate limiting by IP or key, and enumeration of sequential codes.",
  ],
  pitfalls: [
    "Codes that cannot cover 365 billion URLs (6 characters or fewer with 62 symbols).",
    "Truncating a hash with no plan for collisions.",
    "A single counter or database instance as the only ID source, with no answer for its failure.",
    "Choosing 301 and then claiming accurate per-click analytics.",
    "Checking whether a code exists and then inserting it as two unguarded steps, so concurrent writers can claim the same code.",
    "Sizing the system for average traffic only, with no headroom for peaks or viral links.",
  ],
  changedConstraints: [
    "Product now wants click analytics per short URL: total clicks, time of click and referrer. What changes in the redirect path and storage?",
    "Users can now request a custom alias, such as short.ly/my-launch. How do you add this without colliding with generated codes?",
    "Links may now expire after a user-chosen time, and expired codes must stop redirecting. How do you enforce and clean this up?",
    "A single link goes viral and receives 1 million redirects per second for an hour. What breaks first, and how do you protect the rest of the service?",
    "Traffic grows 10x and users are now global. How do you keep redirects fast in every region?",
    "Short links are being used to spread malware. How do you stop redirects to known-bad destinations?",
  ],
};

const notes: Record<string, SystemDesignInterviewerNotes> = {"url-shortener": urlShortener};

export function systemDesignNotesFor(topicId: string): SystemDesignInterviewerNotes | undefined {
  return notes[topicId];
}
