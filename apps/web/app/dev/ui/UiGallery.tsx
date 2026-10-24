"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Composer, type ComposerDesignSystem } from "@/components/composer/Composer";
import type { HomeTileId } from "@/components/home/home-kinds";
import { AppShell } from "@/components/shell/AppShell";
import { FrodiCard } from "@/components/shell/FrodiCard";
import { TemplateCard } from "@/components/templates/TemplateCard";
import type { GalleryTemplate } from "@/components/TemplateGallery";
import { Avatar, AvatarStack } from "@/components/ui/Avatar";
import { Badge, Chip, Eyebrow, FilterChip, Kbd, StatePill, Tag } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { Card, CardHead, Panel } from "@/components/ui/Card";
import { CountryPicker } from "@/components/ui/CountryPicker";
import { Dialog, Sheet } from "@/components/ui/Dialog";
import { GLYPH_PATHS, Glyph, type GlyphName } from "@/components/ui/glyph";
import { Field, Input, SearchInput, Select, Textarea } from "@/components/ui/Input";
import { KindBadge, KindIcon } from "@/components/ui/KindBadge";
import { Meter, StairsMeter } from "@/components/ui/Meter";
import { MenuItem, MenuLabel, MenuSeparator, Popover } from "@/components/ui/Popover";
import { Switch, SwitchRow } from "@/components/ui/Switch";
import { Segmented, Tabs } from "@/components/ui/Tabs";
import { Tooltip } from "@/components/ui/Tooltip";
import type { DeckRatio } from "@/lib/create-project";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { KIND_IDS, type ProjectKindId } from "@/lib/kinds";
import { ensureTemplates } from "@/lib/lists-cache";

const DEMO_DS: ComposerDesignSystem[] = [
  { id: "rodiumai", name: "RodiumAi", scope: "team", preview: { colors: ["#EB6118", "#1C1F26", "#F6F4F0"], display: "Open Sauce Sans" } },
  { id: "luxe", name: "Maison Luxe", scope: "personal", preview: { colors: ["#C9A227", "#111111", "#F5F1E8"], display: "Playfair Display" } },
  { id: "sante", name: "Santé Plus", scope: "shared", preview: { colors: ["#0EA5E9", "#F8FAFC", "#0F172A"], display: "Inter" } },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 14, paddingBottom: 28, borderBottom: "1px solid var(--f-line)" }}>
      <h2 style={{ fontSize: 20, fontWeight: 600 }}>{title}</h2>
      {children}
    </section>
  );
}

const row = { display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" } as const;

function Primitives() {
  const [tab, setTab] = useState<"grid" | "list" | "shared">("grid");
  const [seg, setSeg] = useState<"fr" | "en">("fr");
  const [kindFilter, setKindFilter] = useState<ProjectKindId | "all">("all");
  const [on, setOn] = useState(true);
  const [dialog, setDialog] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [country, setCountry] = useState("TG");
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 28 }}>
      <Section title="Buttons">
        <div style={row}>
          <Button icon="plus">Nouveau projet</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="subtle">Subtle</Button>
          <Button variant="dark">Dark</Button>
          <Button variant="danger" icon="trash">Supprimer</Button>
          <Button variant="link">Lien</Button>
          <Button loading>Chargement</Button>
          <Button disabled>Désactivé</Button>
        </div>
        <div style={row}>
          <Button size="lg" iconEnd="arrow-right">Commencer</Button>
          <Button size="sm" variant="ghost" icon="zap">Passer à Scale</Button>
          <Button size="xs" variant="subtle">XS</Button>
          <IconButton icon="share" label="Partager" />
          <IconButton icon="more" label="Plus" size="sm" />
          <IconButton icon="star" label="Favori" plain />
          <IconButton icon="settings" label="Réglages" square />
          <IconButton icon="code" label="Code" aria-pressed />
          <IconButton icon="github" label="GitHub" href="https://github.com/RodiumAi/Forge" external />
        </div>
      </Section>

      <Section title="Badges, tags, pills, chips">
        <div style={row}>
          <Badge>Neutre</Badge>
          <Badge tone="pro">Pro</Badge>
          <Badge tone="free">Free</Badge>
          <Badge tone="solid">Solid</Badge>
          <Badge tone="new">Nouveau</Badge>
          <Tag>Brouillon</Tag>
          <Tag tone="ok" icon="check">Payée</Tag>
          <Tag tone="warn">En attente</Tag>
          <Tag tone="danger">Échec</Tag>
          <Tag tone="info">Info</Tag>
          <Tag tone="orange">Admin</Tag>
        </div>
        <div style={row}>
          <StatePill state="live">En ligne</StatePill>
          <StatePill state="gen">Forge construit</StatePill>
          <StatePill state="draft">Brouillon</StatePill>
          <StatePill state="err">Interrompu</StatePill>
          <Chip icon="sparkles">16:9, 4:3, 1:1</Chip>
          <Kbd>Ctrl K</Kbd>
          <Eyebrow>Ce que Forge construit</Eyebrow>
        </div>
        <div style={row}>
          <FilterChip pressed={kindFilter === "all"} onClick={() => setKindFilter("all")} count={42}>
            Tous
          </FilterChip>
          {KIND_IDS.map((k) => (
            <FilterChip key={k} pressed={kindFilter === k} onClick={() => setKindFilter(k)} count={7}>
              {k}
            </FilterChip>
          ))}
        </div>
        <div style={row}>
          {KIND_IDS.map((k) => (
            <KindBadge key={k} kind={k} />
          ))}
          {KIND_IDS.map((k) => (
            <KindIcon key={k} kind={k} />
          ))}
        </div>
      </Section>

      <Section title="Cards, panels, avatars">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          <Card>
            <CardHead title="Utilisation FRODI" action={<a href="#billing">Détails</a>} />
            <p className="f-muted">Card avec en-tête et action.</p>
          </Card>
          <Card interactive tabIndex={0}>
            <CardHead title="Carte cliquable" />
            <p className="f-muted">Se soulève au survol.</p>
          </Card>
          <Card dashed>
            <p className="f-muted">Carte pointillée (nouveau projet)</p>
          </Card>
        </div>
        <Panel title="Panel" lead="Bloc des réglages et de l'abonnement." actions={<Button size="sm" variant="ghost">Modifier</Button>}>
          <SwitchRow title="E-mails produit" description="Nouveautés de Forge, une fois par mois" checked={on} onChange={setOn} />
          <SwitchRow title="Désactivé" description="Exemple désactivé" checked={false} onChange={() => undefined} disabled />
        </Panel>
        <div style={row}>
          <Avatar name="Parfait Toke" />
          <Avatar name="Awa Mensah" tone="other" />
          <Avatar name="Koffi Agbeko" size="sm" tone="other" />
          <Avatar name="Ama" size="xs" />
          <Avatar name="Large" size="lg" />
          <AvatarStack>
            <Avatar name="Parfait Toke" size="sm" />
            <Avatar name="Awa Mensah" size="sm" tone="other" />
            <Avatar name="Koffi Agbeko" size="sm" tone="other" />
          </AvatarStack>
        </div>
      </Section>

      <Section title="Tabs, segmented, menus, dialogs, tooltip">
        <div style={row}>
          <Tabs
            label="Vue"
            value={tab}
            onChange={setTab}
            items={[
              { id: "grid", label: "Tous", icon: "grid" },
              { id: "list", label: "Les miens", icon: "list" },
              { id: "shared", label: "Partagés avec moi", icon: "users" },
            ]}
          />
          <Segmented label="Langue" value={seg} onChange={setSeg} items={[{ id: "fr", label: "FR" }, { id: "en", label: "EN" }]} />
          <Popover trigger={<Button variant="ghost" iconEnd="chevron-down">Menu</Button>} label="Actions">
            {(close) => (
              <>
                <MenuLabel>Projet</MenuLabel>
                <MenuItem icon="eye" onClick={close}>Ouvrir</MenuItem>
                <MenuItem icon="edit" onClick={close} meta={<Kbd>F2</Kbd>}>Renommer</MenuItem>
                <MenuItem icon="copy" onClick={close} hint="Une copie dans vos projets">Dupliquer</MenuItem>
                <MenuSeparator />
                <MenuItem icon="trash" danger onClick={close}>Supprimer</MenuItem>
              </>
            )}
          </Popover>
          <Popover tone="dark" role="listbox" trigger={<button type="button" className="f-c-btn">Popover sombre</button>} label="Choix">
            {(close) => (
              <>
                <MenuItem role="option" selected icon="sparkles" meta={<Badge tone="free">Free</Badge>} onClick={close}>Auto</MenuItem>
                <MenuItem role="option" icon="cpu" meta={<Badge tone="pro">Pro</Badge>} onClick={close}>Modèle</MenuItem>
              </>
            )}
          </Popover>
          <Button variant="ghost" onClick={() => setDialog(true)}>Dialog</Button>
          <Button variant="ghost" onClick={() => setSheet(true)}>Sheet</Button>
          <Tooltip content="Le choix du modèle est inclus dans Pro">
            <IconButton icon="info" label="Aide" plain />
          </Tooltip>
        </div>
        <Dialog
          open={dialog}
          onClose={() => setDialog(false)}
          title="Partager le projet"
          description="Invitez par e-mail ou copiez le lien public."
          footer={
            <>
              <Button variant="ghost" onClick={() => setDialog(false)}>Annuler</Button>
              <Button onClick={() => setDialog(false)}>Inviter</Button>
            </>
          }
        >
          <Field label="E-mail" hint="La personne reçoit un lien">
            <Input placeholder="nom@exemple.com" data-autofocus />
          </Field>
        </Dialog>
        <Sheet open={sheet} onClose={() => setSheet(false)} title="Bottom sheet">
          <p className="f-muted">Contenu de la feuille.</p>
        </Sheet>
      </Section>

      <Section title="Inputs and switches">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          <Field label="Nom du projet">
            <Input defaultValue="Vitrine boulangerie" />
          </Field>
          <Field label="Avec erreur" error="Ce nom est déjà pris">
            <Input defaultValue="Echo" />
          </Field>
          <Field label="Rôle">
            <Select defaultValue="editor">
              <option value="viewer">Lecteur</option>
              <option value="editor">Éditeur</option>
            </Select>
          </Field>
          <Field label="Description">
            <Textarea defaultValue="Une page qui convertit." />
          </Field>
        </div>
        <div style={row}>
          <SearchInput label="Rechercher" placeholder="Rechercher un modèle" />
          <Switch checked={on} onChange={setOn} label="Activer" />
          <Switch checked={!on} onChange={(v) => setOn(!v)} label="Petit" size="sm" />
        </div>
      </Section>

      <Section title="Meters">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, alignItems: "end" }}>
          <StairsMeter value={0.62} label="FRODI" valueText="6 240 / 10 000" />
          <StairsMeter value={0.62} label="FRODI" steps={18} size="lg" />
          <StairsMeter value={0.15} label="FRODI" size="sm" steps={6} />
          <Meter value={0.38} label="Sièges" legend={["7 / 10 sièges", "3 libres"]} />
          <Meter value={0.9} label="Stockage" level="warn" size="lg" legend={["90 %", "Bientôt plein"]} />
          <Meter value={1} label="FRODI" level="danger" legend={["0 FRODI", "Recharge lundi"]} />
        </div>
        <div style={{ maxWidth: 260 }}>
          <FrodiCard />
        </div>
      </Section>

      <Section title="Country picker (payment countries API)">
        <div style={row}>
          <CountryPicker value={country} onChange={setCountry} />
          <CountryPicker value={country} onChange={setCountry} align="start" />
          <span className="f-muted">Choisi : {country}</span>
        </div>
      </Section>

      <Section title="Glyphs">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))", gap: 8 }}>
          {(Object.keys(GLYPH_PATHS) as GlyphName[]).map((name) => (
            <div key={name} style={{ display: "grid", justifyItems: "center", gap: 6, padding: 10, borderRadius: 12, background: "var(--f-surface)", border: "1px solid var(--f-line)", fontSize: 11, color: "var(--f-muted)" }}>
              <Glyph name={name} />
              {name}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function ComposerDemo() {
  const [value, setValue] = useState("");
  const [tileId, setTileId] = useState<HomeTileId>("blank");
  const [ds, setDs] = useState<string | null>("rodiumai");
  const [format, setFormat] = useState<DeckRatio | undefined>(undefined);
  const [code, setCode] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  return (
    <Section title="Composer">
      <Composer
        value={value}
        onChange={setValue}
        onSubmit={() => setSent(`${tileId} / ${format ?? "-"} / ${ds ?? "none"}: ${value}`)}
        onAddFiles={() => undefined}
        tileId={tileId}
        onTileChange={(id) => {
          setTileId(id);
          setFormat(undefined);
        }}
        enabledKinds={KIND_IDS}
        deckFormat={format}
        onDeckFormatChange={setFormat}
        designSystems={DEMO_DS}
        designSystemId={ds}
        onDesignSystemChange={setDs}
        manageDesignSystemsHref="#"
        codeMode={code}
        onCodeModeChange={setCode}
      />
      {sent ? <p className="f-muted">Envoyé : {sent}</p> : null}
      <div style={{ maxWidth: 420 }}>
        <Composer
          variant="compact"
          value=""
          onChange={() => undefined}
          onSubmit={() => undefined}
          tileId="blank"
          onTileChange={() => undefined}
          enabledKinds={KIND_IDS}
          showDesignSystems={false}
        />
      </div>
    </Section>
  );
}

function TemplatesDemo() {
  const { locale } = useI18n();
  const [templates, setTemplates] = useState<GalleryTemplate[]>([]);
  useEffect(() => {
    void ensureTemplates(locale)
      .then((list) => setTemplates(list as GalleryTemplate[]))
      .catch(() => setTemplates([]));
  }, [locale]);
  const picks = useMemo(() => {
    const byKind = (k: ProjectKindId, n: number) => templates.filter((x) => (x.kind ?? "web") === k).slice(0, n);
    return [...byKind("slides", 3), ...byKind("web", 1), ...byKind("mobile", 1), ...byKind("codelab", 1), ...byKind("design_system", 1)];
  }, [templates]);
  return (
    <Section title="Template cards (paper band)">
      <div className="f-paper" style={{ borderRadius: 32, padding: "clamp(16px, 4vw, 40px)" }}>
        {picks.length ? (
          <div className="f-tgrid">
            {picks.map((tpl, i) => (
              <TemplateCard key={tpl.id} template={tpl} index={i} href={`#tpl-${tpl.id}`} />
            ))}
          </div>
        ) : (
          <p style={{ color: "var(--f-muted)" }}>Templates from the API (GET /templates) appear here.</p>
        )}
      </div>
    </Section>
  );
}

export function UiGallery() {
  return (
    <AppShell active="home" title="UI gallery">
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 24 }}>
        <p className="f-muted">
          Dev only. Each block renders once in the dark theme and once in the light theme; the shell around follows the
          app theme.
        </p>
        {(["dark", "light"] as const).map((theme) => (
          <div
            key={theme}
            className={theme === "dark" ? "f-theme-dark f-scope" : "f-theme-light f-scope"}
            style={{ background: "var(--f-bg)", color: "var(--f-text)", borderRadius: 24, border: "1px solid var(--f-line)", padding: "clamp(14px, 3vw, 32px)", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 28 }}
          >
            <Eyebrow>{theme === "dark" ? "Thème sombre" : "Thème clair"}</Eyebrow>
            <ComposerDemo />
            <Primitives />
            <TemplatesDemo />
          </div>
        ))}
      </div>
    </AppShell>
  );
}
