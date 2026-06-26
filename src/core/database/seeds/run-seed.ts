import dataSource from '../data-source';

/** Semillas idempotentes (idiomas soportados). */
async function run(): Promise<void> {
  await dataSource.initialize();

  const languages = [
    { code: 'es', name: 'Spanish', nativeName: 'Español', enabled: true },
    { code: 'en', name: 'English', nativeName: 'English', enabled: true },
    { code: 'ay', name: 'Aymara', nativeName: 'Aymar aru', enabled: true },
    { code: 'qu', name: 'Quechua', nativeName: 'Runa simi', enabled: true },
  ];

  for (const lang of languages) {
    await dataSource.query(
      `INSERT INTO "languages" ("code","name","native_name","enabled")
       VALUES ($1,$2,$3,$4)
       ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name",
         "native_name" = EXCLUDED."native_name", "enabled" = EXCLUDED."enabled";`,
      [lang.code, lang.name, lang.nativeName, lang.enabled],
    );
  }

  // eslint-disable-next-line no-console
  console.log(`Seed completado: ${languages.length} idiomas.`);
  await dataSource.destroy();
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed falló:', err);
  process.exit(1);
});
