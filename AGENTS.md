> [!IMPORTANT]
> Este proyecto se despliega en [Vercel](https://vercel.com), conectado al repo
> de GitHub: cada push a `main` dispara un build y deploy a producción
> automáticamente (ver `.github/workflows/ci.yml`). El backend es
> [Supabase](https://supabase.com) (proyecto `iaiiwtqqiaqxnzxjqcnt`) — ya no
> hay nada de Lovable en este proyecto.
>
> `main` no tiene branch protection: un CI en rojo avisa por correo pero no
> bloquea el push. Aun así, evita reescribir historia ya pusheada (force push,
> rebase/amend/squash de commits públicos) — un push a `main` va derecho a
> producción, así que mantén la rama en estado funcional.
