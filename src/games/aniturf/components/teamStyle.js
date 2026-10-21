// Each team's look, as literal class strings (Tailwind only generates what it
// can read in source). Colour is never the whole signal: a team also has its
// own texture — Red's hatch, Blue's screentone — and its letter, so a claimed
// square reads for a colour-blind player and in greyscale print alike.
export const TEAM_STYLE = {
  red: {
    name: 'Red',
    letter: 'R',
    fill: 'bg-team-red',
    text: 'text-team-red',
    border: 'border-team-red',
    ring: 'ring-team-red',
    // Paper lines over the fill, so the texture survives on the dark ink.
    texture: 'hatch [--hatch:rgb(250_248_243/0.35)]',
    goal: 'left to right',
    tone: 'team-red',
  },
  blue: {
    name: 'Blue',
    letter: 'B',
    fill: 'bg-team-blue',
    text: 'text-team-blue',
    border: 'border-team-blue',
    ring: 'ring-team-blue',
    texture: 'halftone [--tone:rgb(250_248_243/0.55)] [--tone-size:6px]',
    goal: 'top to bottom',
    tone: 'team-blue',
  },
};
