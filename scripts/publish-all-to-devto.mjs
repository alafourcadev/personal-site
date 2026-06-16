import fs from 'node:fs';
import path from 'path';
import matter from 'gray-matter';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOG_PATH = path.join(__dirname, '../src/content/blog');
const API_URL = 'https://dev.to/api/articles';

// Load API Key from environment or .env.local
const DEVTO_API_KEY = process.env.DEVTO_API_KEY;

if (!DEVTO_API_KEY) {
  console.error('❌ Error: DEVTO_API_KEY no encontrada en el entorno o .env.local.');
  process.exit(1);
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function publishAllToDevTo() {
  const files = fs.readdirSync(BLOG_PATH)
    .filter(f => f.endsWith('.md') || f.endsWith('.mdx'))
    .sort(); // Alfabetico por defecto

  console.log(`📂 Encontrados ${files.length} artículos. Iniciando publicación masiva...`);

  for (const file of files) {
    const filePath = path.join(BLOG_PATH, file);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const { data, content } = matter(fileContent);

    // Saltar borradores
    if (data.draft === true) {
      console.log(`⏩ Saltando borrador: ${file}`);
      continue;
    }

    console.log(`🚀 Publicando: ${data.title}...`);

    const article = {
      article: {
        title: data.title,
        published: false, // Siempre como borrador
        body_markdown: content,
        tags: (data.tags || [])
          .slice(0, 4)
          .map(tag => tag.toLowerCase().replace(/[^a-z0-9]/g, '')),
        series: "100ArchitectureDays",
        canonical_url: `https://alafourca.dev/blog/${file.replace(/\.(md|mdx)$/, '')}`,
        description: data.description,
        main_image: data.image ? `https://alafourca.dev${data.image}` : undefined
      }
    };

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': DEVTO_API_KEY
        },
        body: JSON.stringify(article)
      });

      const result = await response.json();

      if (response.ok) {
        console.log(`✅ Borrador creado: ${result.url}`);
      } else {
        console.error(`❌ Error en ${file}:`, result.error || result.errors);
      }
    } catch (error) {
      console.error(`❌ Error de red en ${file}:`, error.message);
    }

    // Delay de 2 segundos para evitar rate limiting (429)
    await sleep(2000);
  }

  console.log('🏁 Proceso de publicación masiva finalizado.');
}

publishAllToDevTo();
