/** Tipos de publicación de Mapia. */
export enum PostType {
  NEWS = 'NEWS',
  NOVELTY = 'NOVELTY',
  PARTY = 'PARTY',
  FOOD_DEAL = 'FOOD_DEAL',
  SALE = 'SALE',
  TRAFFIC = 'TRAFFIC',
  BLOCKADE = 'BLOCKADE',
  ACCIDENT = 'ACCIDENT',
  SERVICE_CUT = 'SERVICE_CUT',
  SECURITY = 'SECURITY',
  LOST_FOUND = 'LOST_FOUND',
  OTHER = 'OTHER',
}

/** Estado del ciclo de vida de una publicación. */
export enum PostStatus {
  PUBLISHED = 'PUBLISHED',
  IN_REVIEW = 'IN_REVIEW',
  VERIFIED = 'VERIFIED',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED',
  DELETED = 'DELETED',
}

/** Visibilidad de cara al feed/mapa. */
export enum PostVisibility {
  PUBLIC = 'PUBLIC',
  HIDDEN = 'HIDDEN',
  DELETED = 'DELETED',
}

/** Etiquetas legibles por tipo (para alerts). */
export const POST_TYPE_LABELS: Record<PostType, { title: string; plural: string }> = {
  [PostType.NEWS]: { title: 'Noticias', plural: 'noticias' },
  [PostType.NOVELTY]: { title: 'Novedades', plural: 'novedades' },
  [PostType.PARTY]: { title: 'Fiestas', plural: 'fiestas' },
  [PostType.FOOD_DEAL]: { title: 'Comida barata', plural: 'comidas baratas' },
  [PostType.SALE]: { title: 'Ventas', plural: 'ventas' },
  [PostType.TRAFFIC]: { title: 'Tráfico', plural: 'reportes de tráfico' },
  [PostType.BLOCKADE]: { title: 'Bloqueos', plural: 'bloqueos' },
  [PostType.ACCIDENT]: { title: 'Accidentes', plural: 'accidentes' },
  [PostType.SERVICE_CUT]: { title: 'Cortes de servicio', plural: 'cortes de servicio' },
  [PostType.SECURITY]: { title: 'Seguridad', plural: 'temas de seguridad' },
  [PostType.LOST_FOUND]: { title: 'Perdidos/Encontrados', plural: 'objetos perdidos/encontrados' },
  [PostType.OTHER]: { title: 'Otros', plural: 'otros sucesos' },
};
