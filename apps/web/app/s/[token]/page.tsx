"use client";

/**
 * A presentation opened from a share link: presentation mode, no account,
 * always the latest version. An edit link adds "Edit in Forge": a signed-in
 * Forge account joins the project as editor while the plan has a free seat;
 * otherwise it stays here, read only.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";

import { DeckPlayer, themeTokensFromDesign } from "@/components/deck-player";
import { useDeckStrings } from "@/components/deck-editor/strings";
import "@/components/deck-editor/deck-editor.css";
import { ApiError, getToken } from "@/lib/api";
import { fetchShared, fetchSharedPresentation, joinShared, sharedAssetUrl, type SharedInfo, type SharedPresentation } from "@/lib/share-links";

export default function SharedDeckPage() {
  return (
    <Suspense fallback={null}>
      <SharedDeck />
    </Suspense>
  );
}

function SharedDeck() {
  const { token } = useParams<{ token: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const { t, locale } = useDeckStrings();
  const [info, setInfo] = useState<SharedInfo | null>(null);
  const [deck, setDeck] = useState<SharedPresentation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Read after mount: the server render has no session.
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => setSignedIn(Boolean(getToken())), []);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchShared(token), fetchSharedPresentation(token)])
      .then(([i, d]) => {
        if (!alive) return;
        setInfo(i);
        setDeck(d);
        document.title = `${d.name} · Forge`;
      })
      .catch((err: Error) => alive && setError(err.message || t("loadError")));
    return () => {
      alive = false;
    };
  }, [token, t]);

  const here = `/s/${encodeURIComponent(token)}`;

  const join = useCallback(async () => {
    if (!getToken()) {
      router.push(`/login?next=${encodeURIComponent(`${here}?join=1`)}`);
      return;
    }
    setJoining(true);
    setNotice(null);
    try {
      const out = await joinShared(token);
      if (out.role === "view") {
        setNotice(out.reason === "no_seat" ? t("sharedNoSeat") : null);
        setJoining(false);
        return;
      }
      router.push(`/projects/${out.project_id}/deck`);
    } catch (err) {
      setJoining(false);
      if (err instanceof ApiError && err.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`${here}?join=1`)}`);
        return;
      }
      setNotice((err as Error)?.message || t("loadError"));
    }
  }, [token, here, router, t]);

  // Back from sign-in with ?join=1: join once, without a second click.
  const wantsJoin = params.get("join") === "1";
  useEffect(() => {
    if (wantsJoin && info?.access === "edit" && getToken()) void join();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot after the link is known
  }, [wantsJoin, info?.access]);

  const tokens = useMemo(() => themeTokensFromDesign(deck?.theme ?? ""), [deck?.theme]);
  const assetUrl = useCallback((path: string) => sharedAssetUrl(token, path), [token]);

  if (error) {
    return (
      <main className="de-root de-center" role="alert">
        <p>{error}</p>
        <Link className="f-btn f-btn-ghost f-btn-sm" href="/">
          {t("sharedOpenForge")}
        </Link>
      </main>
    );
  }
  if (!deck || !info) {
    return (
      <main className="de-root de-center" aria-busy="true">
        {t("sharedLoading")}
      </main>
    );
  }
  if (deck.deck.slides.length === 0) {
    return <main className="de-root de-center">{t("sharedEmpty")}</main>;
  }

  return (
    <main className="de-present de-shared" aria-label={deck.name}>
      <DeckPlayer deck={deck.deck} slides={deck.slides} tokens={tokens} assetUrl={assetUrl} badge locale={locale} />
      {info.access === "edit" ? (
        <div className="de-shared-bar">
          {notice ? (
            <p className="de-shared-note" role="status">
              {notice}
            </p>
          ) : null}
          <button type="button" className="f-btn f-btn-primary f-btn-sm" onClick={() => void join()} disabled={joining}>
            {joining ? <Loader2 size={14} className="f-spin" aria-hidden /> : <Pencil size={14} aria-hidden />}
            <span>{joining ? t("sharedJoining") : signedIn ? t("sharedEdit") : t("sharedSignIn")}</span>
          </button>
        </div>
      ) : null}
    </main>
  );
}
