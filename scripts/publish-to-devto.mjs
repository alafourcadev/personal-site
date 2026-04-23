import fs from 'node:fs';
import path from 'path';
import matter from 'gray-matter';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOG_PATH = path.join(__dirname, '../src/content/blog');
const API_URL = 'https://dev.to/api/articles';

// Load API Key from environment or .env file manually
const DEVTO_API_KEY = process.env.DEVTO_API_KEY;

if (!DEVTO_API_KEY) {
  console.error('❌ Error: DEVTO_API_KEY no encontrada en el entorno.');
  process.exit(1);
}

async function publishToDevTo() {
  const files = fs.readdirSync(BLOG_PATH)
    .filter(f => f.endsWith('.md') || f.endsWith('.mdx'))
    .map(f => ({
      name: f,
      time: fs.statSync(path.join(BLOG_PATH, f)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time);

  if (files.length === 0) {
    console.log('No se encontraron artículos para publicar.');
    return;
  }

  const latestFile = files[0].name;
  const filePath = path.join(BLOG_PATH, latestFile);
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(fileContent);

  console.log(`🚀 Preparando publicación de: ${data.title}...`);

  const article = {
    article: {
      title: data.title,
      published: false, // Siempre como borrador para revisión final
      body_markdown: content,
      tags: data.tags
        .slice(0, 4)
        .map(tag => tag.toLowerCase().replace(/[^a-z0-9]/g, '')), // Dev.to permite max 4 y sin espacios/especiales
      series: "100ArchitectureDays",
      canonical_url: `https://alafourca.dev/blog/${latestFile.replace(/\.(md|mdx)$/, '')}`,
      description: data.description,
      main_image: `https://alafourca.dev${data.image}`
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
      console.log(`✅ ¡Éxito! Borrador creado en Dev.to: ${result.url}`);
      console.log('Entrá a tu dashboard de Dev.to para darle el toque final y publicar.');
    } else {
      console.error('❌ Error de la API de Dev.to:', result.error || result.errors);
    }
  } catch (error) {
    console.error('❌ Error de red:', error.message);
  }
}

publishToDevTo();
