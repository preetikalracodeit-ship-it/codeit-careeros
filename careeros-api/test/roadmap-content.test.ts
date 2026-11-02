import { describe, expect, it } from "vitest";
import {
  CAREER_CAPSTONE_MATERIALS,
  CAREER_STUDY_GUIDES,
  CAREERS,
  SKILL_STUDY_MATERIALS,
} from "../src/scripts/demoContent.js";

describe("career roadmap study content", () => {
  it("provides a detailed guide for every assessed skill in every career path", () => {
    for (const career of CAREERS) {
      const careerGuides = CAREER_STUDY_GUIDES[career.name];
      expect(careerGuides, career.name).toBeDefined();

      for (const weight of career.weights) {
        const guide = careerGuides[weight.name];
        expect(guide, `${career.name}: ${weight.name}`).toBeDefined();
        if (!guide) throw new Error(`Missing study guide for ${career.name}: ${weight.name}`);
        expect(guide.topics.length, `${career.name}: ${weight.name} topics`).toBeGreaterThanOrEqual(2);
        expect(guide.practice, `${career.name}: ${weight.name} practice`).toBeTruthy();
        expect(guide.evidence, `${career.name}: ${weight.name} evidence`).toBeTruthy();
        const material = SKILL_STUDY_MATERIALS[weight.name];
        expect(material, `${career.name}: ${weight.name} study material`).toBeDefined();
        if (!material) throw new Error(`Missing study material for ${weight.name}`);
        expect(material.lessons.length, `${career.name}: ${weight.name} lessons`).toBeGreaterThanOrEqual(3);
        expect(material.resources.length, `${career.name}: ${weight.name} resources`).toBeGreaterThanOrEqual(2);
        for (const resource of material.resources) {
          expect(resource.url).toMatch(/^https:\/\//);
        }
      }

      const capstoneMaterial = CAREER_CAPSTONE_MATERIALS[career.name];
      expect(capstoneMaterial.lessons.length).toBeGreaterThanOrEqual(3);
      expect(capstoneMaterial.resources.length).toBeGreaterThanOrEqual(2);
      for (const resource of capstoneMaterial.resources) {
        expect(resource.url).toMatch(/^https:\/\//);
      }
    }
  });
});
