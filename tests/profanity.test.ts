/**
 * censorProfanity() — the client mirror of the database's
 * censor_profanity() (migration 0013). If an expectation here changes,
 * the SQL word lists must change with it, and vice versa.
 */
import { describe, expect, it } from "vitest";
import { censorProfanity } from "@/lib/profanity";

describe("censorProfanity", () => {
  it("masks strong words", () => {
    expect(censorProfanity("fuck")).toBe("****");
    expect(censorProfanity("shit")).toBe("****");
    expect(censorProfanity("this is bullshit")).toBe("this is bull****");
  });

  it("is case-insensitive", () => {
    expect(censorProfanity("FUCK this")).toBe("**** this");
    expect(censorProfanity("Shit happens")).toBe("**** happens");
  });

  it("masks strong words inside other words", () => {
    expect(censorProfanity("fucking")).toBe("****ing");
    expect(censorProfanity("assholes")).toBe("****s");
  });

  it("masks every occurrence", () => {
    expect(censorProfanity("shit shit shit")).toBe("**** **** ****");
  });

  it("masks ambiguous words only as whole words", () => {
    expect(censorProfanity("you ass")).toBe("you ****");
    expect(censorProfanity("the assessment is due")).toBe("the assessment is due");
    expect(censorProfanity("in the cockpit")).toBe("in the cockpit");
    expect(censorProfanity("read some Dickens")).toBe("read some Dickens");
    expect(censorProfanity("classic grass pass")).toBe("classic grass pass");
  });

  it("leaves clean text alone", () => {
    const clean = "Meet at Walter Library at 4 to review chapter 12?";
    expect(censorProfanity(clean)).toBe(clean);
  });

  it("handles punctuation boundaries", () => {
    expect(censorProfanity("what the fuck?!")).toBe("what the ****?!");
    expect(censorProfanity("ass.")).toBe("****.");
  });
});
