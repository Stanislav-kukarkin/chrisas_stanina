import { motion } from 'motion/react';
import { type ShoppingFavorite } from '@chrisasstanina/firebase';

interface FavoritesRowProps {
  favorites: ShoppingFavorite[];
  onAdd: (favorite: ShoppingFavorite) => Promise<void>;
  disabled?: boolean;
}

export function FavoritesRow({ favorites, onAdd, disabled }: FavoritesRowProps) {
  if (favorites.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Избранное пусто — добавьте частые товары через «В избранное» на карточке товара.
      </p>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {favorites.map((favorite, index) => (
        <motion.button
          key={favorite.id}
          type="button"
          disabled={disabled}
          onClick={() => onAdd(favorite)}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.05, duration: 0.3 }}
          whileHover={{ scale: disabled ? 1 : 1.04 }}
          whileTap={{ scale: disabled ? 1 : 0.98 }}
          className="shrink-0 rounded-full border border-zinc-700/80 bg-zinc-950/50 px-4 py-2 text-sm text-zinc-200 transition hover:border-violet-500/50 hover:bg-violet-500/10 hover:text-white disabled:opacity-50"
        >
          {favorite.name}
        </motion.button>
      ))}
    </div>
  );
}
