export interface PersonTree {
  pid: string;
  name: string;
  lifespan: {
    birth?: {
      date: string;
      place: string;
    };
    death?: {
      date: string;
      place: string;
    };
  };
}

export interface Couple {
  relationshipId: string;
  husband?: PersonTree;
  wife?: PersonTree;
  children: PersonTree[];
  married?: {
    date: string;
    place: string;
  };
}

export interface FamilySearchResponse {
  persons: PersonTree[];
  relationships: Couple[];
  sources: Array<{
    id: string;
    title: string;
    url: string;
  }>;
  citations: Array<{
    sourceId: string;
    text: string;
    quality: "HIGH" | "MEDIUM" | "LOW";
  }>;
}

export const familySearchSchema = {
  type: "object",
  properties: {
    persons: {
      type: "array",
      items: {
        type: "object",
        required: ["pid", "name"],
        properties: {
          pid: { type: "string" },
          name: { type: "string" },
          lifespan: {
            type: "object",
            properties: {
              birth: { type: "object" },
              death: { type: "object" }
            }
          }
        }
      }
    },
    relationships: {
      type: "array"
    },
    sources: {
      type: "array"
    }
  }
};
