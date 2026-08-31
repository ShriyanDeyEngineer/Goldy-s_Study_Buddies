/**
 * censorProfanity() / containsProfanity() — the client mirror of the
 * database's censor_profanity() (migrations 0013/0017). If an expectation
 * here changes, the SQL word lists must change with it, and vice versa.
 */
import { describe, expect, it } from "vitest";
import { censorProfanity, containsProfanity } from "@/lib/profanity";

describe("censorProfanity", () => {
  it("masks strong words", () => {
    expect(censorProfanity("fuck")).toBe("****");
    expect(censorProfanity("shit")).toBe("****");
  });

  it("masks the WHOLE containing word, not just the match", () => {
    expect(censorProfanity("fucking")).toBe("****");
    expect(censorProfanity("this is bullshit")).toBe("this is ****");
    expect(censorProfanity("assholes")).toBe("****");
  });

  it("catches leetspeak, symbol swaps, and repeated letters", () => {
    expect(censorProfanity("f4ck")).toBe("****");
    expect(censorProfanity("fvck")).toBe("****");
    expect(censorProfanity("f*ck")).toBe("****");
    expect(censorProfanity("fuuuuck")).toBe("****");
    expect(censorProfanity("sh1t")).toBe("****");
    expect(censorProfanity("what a ret4rd")).toBe("what a ****");
    expect(censorProfanity("f\u200Buck")).toBe("****");
  });

  it("catches spaced and separated spellings", () => {
    expect(censorProfanity("f u c k")).toBe("****");
    expect(censorProfanity("f-u-c-k")).toBe("****");
    expect(censorProfanity("f.u.c.k")).toBe("****");
    expect(censorProfanity("what the f_u_c_k?!")).toBe("what the ****?!");
    expect(censorProfanity("s h i t happens")).toBe("**** happens");
  });

  it("is case-insensitive", () => {
    expect(censorProfanity("FUCK this")).toBe("**** this");
    expect(censorProfanity("Shit happens")).toBe("**** happens");
  });

  it("masks every occurrence", () => {
    expect(censorProfanity("shit shit shit")).toBe("**** **** ****");
  });

  it("masks ambiguous words only as exact whole words", () => {
    expect(censorProfanity("you ass")).toBe("you ****");
    expect(censorProfanity("ass.")).toBe("****.");
    expect(censorProfanity("the assessment is due")).toBe("the assessment is due");
    expect(censorProfanity("in the cockpit")).toBe("in the cockpit");
    expect(censorProfanity("read some Dickens")).toBe("read some Dickens");
    expect(censorProfanity("classic grass pass")).toBe("classic grass pass");
  });

  it("leaves clean text alone", () => {
    const clean = "Meet at Walter Library at 4 to review chapter 12?";
    expect(censorProfanity(clean)).toBe(clean);
  });

  it("preserves punctuation around a masked word", () => {
    expect(censorProfanity("what the fuck?!")).toBe("what the ****?!");
  });
});

describe("containsProfanity", () => {
  it("flags swears, plain or spaced or embedded", () => {
    expect(containsProfanity("fuck")).toBe(true);
    expect(containsProfanity("f u c k")).toBe(true);
    expect(containsProfanity("f-u-c-k")).toBe(true);
    expect(containsProfanity("StudyFuckers")).toBe(true);
    expect(containsProfanity("f4ck this group")).toBe(true);
    expect(containsProfanity("you ass")).toBe(true);
  });

  it("passes real names and clean text (Scunthorpe rule)", () => {
    expect(containsProfanity("Dickson")).toBe(false);
    expect(containsProfanity("Dickens")).toBe(false);
    expect(containsProfanity("Assessment Prep Group")).toBe(false);
    expect(containsProfanity("Cockpit Physics")).toBe(false);
    expect(containsProfanity("CSCI 1133 Study Group")).toBe(false);
  });
});

describe("no catastrophic backtracking (ReDoS regression)", () => {
  // The old regex took ~9 s on a 2,000-char run of one character, which
  // blocked the Node event loop inside server-action validation.
  const adversarial = [
    "a".repeat(5000),
    "*".repeat(5000),
    "s".repeat(5000),
    "a*".repeat(2500),
    "f" + "u".repeat(2000) + "!".repeat(2000),
    "the quick brown fox ".repeat(300),
  ];

  it("stays fast on pathological input", () => {
    for (const input of adversarial) {
      const start = performance.now();
      censorProfanity(input);
      containsProfanity(input);
      expect(performance.now() - start).toBeLessThan(250);
    }
  });
});
