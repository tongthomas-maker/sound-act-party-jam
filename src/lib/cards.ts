export type ClueType = "sound" | "act" | "either";
export type CategoryId = "animals" | "things" | "human" | "whats";

export interface Card {
  id: string;
  prompt: string;
  category: CategoryId;
  clueType: ClueType;
}

export const CATEGORIES: { id: CategoryId; label: string; emoji: string }[] = [
  { id: "animals", label: "Animals", emoji: "🐾" },
  { id: "things", label: "Things & Sounds", emoji: "🔊" },
  { id: "human", label: "Human Sounds", emoji: "👤" },
  { id: "whats", label: "What's Happening?!", emoji: "😂" },
];

const mk = (
  category: CategoryId,
  clueType: ClueType,
  prompts: string[],
): Card[] =>
  prompts.map((prompt, i) => ({
    id: `${category}-${clueType}-${i}`,
    prompt,
    category,
    clueType,
  }));

export const CARDS: Card[] = [
  // 🐾 ANIMALS (~40)
  ...mk("animals", "sound", [
    "Dog barking",
    "Rooster crowing",
    "Cat meowing",
    "Cow mooing",
    "Lion roaring",
    "Mosquito buzzing",
    "Owl hooting",
    "Wolf howling",
    "Pig oinking",
    "Sheep bleating",
    "Horse neighing",
    "Donkey braying",
    "Frog croaking",
    "Duck quacking",
    "Seagull squawking",
    "Snake hissing",
    "Bee buzzing",
    "Dolphin clicking",
    "Elephant trumpeting",
    "Goat screaming",
  ]),
  ...mk("animals", "act", [
    "Gorilla beating its chest",
    "Crab walking sideways",
    "Kangaroo hopping",
    "Snake slithering",
    "Penguin waddling",
    "Flamingo standing on one leg",
    "Sloth climbing very slowly",
    "T-Rex with tiny arms",
    "Cat licking its paw",
    "Dog chasing its tail",
  ]),
  ...mk("animals", "either", [
    "Angry chihuahua",
    "Monkey in a zoo",
    "Hungry baby bird",
    "Turkey gobbling",
    "Cat coughing up a hairball",
    "Dog begging for food",
    "Parrot repeating you",
    "Woodpecker on a tree",
    "Rattlesnake warning you",
    "Wet dog shaking off",
  ]),

  // 🔊 THINGS & SOUNDS (~45)
  ...mk("things", "sound", [
    "Police siren",
    "Ambulance passing by",
    "Chainsaw",
    "Popcorn popping",
    "Microwave beeping",
    "Jackhammer",
    "Race car speeding by",
    "Motorcycle revving",
    "Alarm clock",
    "Doorbell",
    "Old phone ringing",
    "Boiling kettle whistling",
    "Balloon deflating",
    "Fireworks",
    "Thunderstorm",
    "Helicopter",
    "Train horn",
    "Car alarm",
    "Vacuum cleaner",
    "Blender making a smoothie",
    "Zipper zipping",
    "Camera shutter",
    "Dial-up internet",
    "Electric drill",
    "Washing machine spinning",
  ]),
  ...mk("things", "act", [
    "Windshield wipers",
    "Revolving door",
    "Ceiling fan spinning",
    "Traffic light changing",
    "Vending machine dropping a snack",
    "Escalator going up",
    "Umbrella opening in the wind",
    "Toaster popping toast",
    "Slot machine",
    "Broken shopping cart wheel",
  ]),
  ...mk("things", "either", [
    "Video game power-up",
    "Roller coaster ride",
    "Pinball machine",
    "Squeaky door",
    "Bubble wrap",
    "Lawn mower",
    "Coffee machine brewing",
    "Bowling strike",
    "Flat tire",
    "Printer jamming",
  ]),

  // 👤 HUMAN SOUNDS & ACTIONS (~35)
  ...mk("human", "sound", [
    "Sneezing",
    "Hiccuping",
    "Snoring",
    "Heavy breathing",
    "Yawning loudly",
    "Gargling mouthwash",
    "Slurping noodles",
    "Crunching chips",
    "Evil laugh",
    "Baby crying",
    "Whistling a tune",
    "Clearing your throat",
    "Crowd cheering",
    "Fake crying",
    "Blowing your nose",
  ]),
  ...mk("human", "act", [
    "Tying your shoes",
    "Brushing your teeth",
    "Putting on tight jeans",
    "Taking a selfie",
    "Doing push-ups",
    "Shaving",
    "Applying lipstick",
    "Texting while walking",
    "Carrying way too many bags",
    "Stretching after waking up",
    "Flossing your teeth",
    "Washing your hair",
  ]),
  ...mk("human", "either", [
    "Eating something way too spicy",
    "Choking on water",
    "Burping",
    "Sniffing something gross",
    "Cracking your knuckles",
    "Falling asleep sitting up",
    "Getting a shot at the doctor",
    "Blowing out birthday candles",
  ]),

  // 😂 WHAT'S HAPPENING?! (~50)
  ...mk("whats", "act", [
    "Stepping on a LEGO",
    "Sneaking in late at night",
    "Slipping on a banana peel",
    "Losing your phone in your own hand",
    "Walking into a glass door",
    "Trying to open a locked door quietly",
    "Chasing the bus and missing it",
    "Dropping your ice cream scoop",
    "Getting stuck in a sweater",
    "Reaching for the last fry",
    "Pretending to work when the boss walks by",
    "Taking a group photo with a timer",
    "Parallel parking badly",
    "Waiting in a very long line",
    "Trying not to laugh in a meeting",
    "Carrying a full cup without spilling",
    "Looking for your keys everywhere",
    "Catching a bug with a cup",
    "Sitting on something wet",
    "Getting caught in a spider web",
  ]),
  ...mk("whats", "sound", [
    "Car won't start",
    "Phone dying at 1%",
    "Stomach growling in silence",
    "Someone snoring on a plane",
    "Neighbors arguing through the wall",
    "Fire alarm at 3am",
    "A balloon popping at a party",
    "Dropping a tray of dishes",
    "Bad karaoke night",
    "Baby screaming in a restaurant",
  ]),
  ...mk("whats", "either", [
    "Getting brain freeze",
    "Waking up late for work",
    "Your food is way too hot",
    "Awkward elevator ride",
    "Losing a game on the last second",
    "Realizing you left the stove on",
    "Being tickled",
    "Getting a text from your crush",
    "First day at a new gym",
    "Running in the rain with no umbrella",
    "Spilling coffee on your shirt",
    "Hearing a weird noise at night",
    "Arguing with a self-checkout machine",
    "Trying to be quiet with chips",
    "Getting sprayed by a hose",
    "Meeting a dog that loves you",
    "Winning the lottery",
    "Getting caught singing in the car",
    "A wobbly restaurant table",
    "Sitting through a boring lecture",
  ]),
];

export function filterCards(
  mode: "sound" | "act" | "mix",
  categories: CategoryId[] | "all",
): Card[] {
  return CARDS.filter((c) => {
    if (categories !== "all" && !categories.includes(c.category)) return false;
    if (mode === "sound") return c.clueType === "sound" || c.clueType === "either";
    if (mode === "act") return c.clueType === "act" || c.clueType === "either";
    return true;
  });
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i] as T;
    a[i] = a[j] as T;
    a[j] = tmp;
  }
  return a;
}

export const CLUE_LABEL: Record<ClueType, string> = {
  sound: "🔊 SOUND IT!",
  act: "🎭 ACT IT!",
  either: "🔊🎭 EITHER!",
};
