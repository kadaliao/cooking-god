const BASE = import.meta.env.BASE_URL;

export const art = (path: string) => `${BASE}art/${path}.webp`;
export const ingredientArt = (id: string) => art(`ingredients/${id}`);
export const toolArt = (id: string) => art(`tools/${id}`);
export const dishArt = (id: string) => art(`dishes/${id}`);
export const bossArt = (id: string) => art(`bosses/${id}`);

export function preloadArt(paths: string[]) {
  for (const p of paths) {
    const img = new Image();
    img.src = p;
  }
}
