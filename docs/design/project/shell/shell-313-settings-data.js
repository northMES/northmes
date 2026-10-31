/* Shared data of the spec page shell-313-settings.dc.html, issue northMES/northmes#313, and its part files: the entries
   of the two settings areas with their icons, routes and landing lines, and the copy of the settings navigation, the
   layout and the landing in English and German (de). The Acme tooling plugin's German-frame label is Finnish (fi),
   as the D2 long-strings preset names it. Every company, plant, person and value is fictional; labels, icons, routes,
   lines and German strings are proposals (rules sections 4, 5 and 12). The plant landing is /$plant/settings (rules 4.3). */
(function () {
  var E = function (id, en, de, icon, route, den, dde, o) {
    return Object.assign({ id: id, en: en, de: de, icon: icon, route: route, den: den, dde: dde, mod: "core", lang: null }, o || {});
  };
  window.NM313 = {
    areas: {
      company: [
        { id: "core", en: "", de: "", entries: [
          E("general", "General", "Allgemein", "Building2", "/settings/$companyId/core/general", "Company name and data language", "Name des Unternehmens und Datensprache"),
          E("formats", "Formats", "Formate", "SlidersHorizontal", "/settings/$companyId/core/formats", "How dates, clock times and numbers look at every plant", "Wie Datum, Uhrzeit und Zahlen in allen Werken aussehen"),
          E("plants", "Plants", "Werke", "LayoutGrid", "/settings/$companyId/core/plants", "The company's plants and their onboarding, and New plant", "Die Werke des Unternehmens, ihr Onboarding und Neues Werk"),
          E("users", "Users", "Benutzer", "Users", "/settings/$companyId/core/users", "People who sign in, and their roles", "Personen mit Anmeldung und ihre Rollen"),
          E("roles", "Roles", "Rollen", "Shield", "/settings/$companyId/core/roles", "Default and custom roles with their permissions", "Standardrollen und eigene Rollen mit ihren Berechtigungen"),
          E("integrations", "Integrations", "Integrationen", "Plug", "/settings/$companyId/core/integrations", "The ERP connection and the AI provider", "Die ERP-Anbindung und der KI-Anbieter"),
          E("audit", "Audit log", "Änderungsprotokoll", "ScrollText", "/settings/$companyId/audit/log", "Every change, who made it and why", "Jede Änderung, wer sie gemacht hat und warum", { mod: "audit" })
        ] },
        { id: "modules", en: "Modules", de: "Module", entries: [
          E("planning", "Planning rules", "Planungsregeln", "CalendarCog", "/settings/$companyId/planning/settings", "Planning rules for every plant of the company", "Planungsregeln für alle Werke des Unternehmens", { mod: "planning" }),
          E("ai", "AI assistant", "KI-Assistent", "Sparkles", "/settings/$companyId/ai/settings", "Provider, budget and usage of the assistant", "Anbieter, Budget und Verbrauch des Assistenten", { mod: "ai" }),
          E("connector", "Pyramid connector", "Pyramid-Anbindung", "ServerCog", "/settings/$companyId/pyramid-connector/settings", "Polling, field mapping and write-back to Pyramid", "Abruf, Feldzuordnung und Rückschreiben an Pyramid", { mod: "pyramid-connector" })
        ] },
        { id: "plugins", en: "Plugins", de: "Erweiterungen", entries: [] }
      ],
      plant: [
        { id: "core", en: "", de: "", entries: [
          E("plant", "Plant", "Werk", "Factory", "/$plant/core/plant", "Name, slug, time zone, production day start and formats", "Name, Kürzel, Zeitzone, Beginn des Produktionstags und Formate"),
          E("machines", "Machines", "Maschinen", "Drill", "/$plant/core/machines", "Equipment with its group, color and plannable flag", "Betriebsmittel mit Gruppe, Farbe und Planbarkeit"),
          E("equipment-groups", "Equipment groups", "Betriebsmittelgruppen", "Layers", "/$plant/core/equipment-groups", "Groups of machines and their colors on the board", "Maschinengruppen und ihre Farben auf der Plantafel"),
          E("calendars", "Calendars", "Betriebskalender und Schichtmodelle", "CalendarDays", "/$plant/core/calendars", "Calendar versions, shift patterns, breaks and deviations", "Kalenderversionen, Schichtmodelle, Pausen und Abweichungen"),
          E("stations", "Stations", "Bedienstationen", "Monitor", "/$plant/core/stations", "Operator stations and their pairing", "Bedienstationen und ihre Kopplung"),
          E("system-health", "System health", "Systemzustand", "Activity", "/$plant/core/system-health", "Readiness, jobs, backups, versions and the last Pyramid poll", "Bereitschaft, Aufträge, Sicherungen, Versionen und der letzte Abruf von Pyramid")
        ] },
        { id: "modules", en: "Modules", de: "Module", entries: [
          E("planning", "Planning rules", "Planungsregeln", "CalendarCog", "/$plant/planning/settings", "This plant's values for the planning rules", "Die Werte dieses Werks für die Planungsregeln", { mod: "planning" })
        ] },
        { id: "plugins", en: "Plugins", de: "Erweiterungen", entries: [
          E("acme", "Acme tooling", "Acme-työkalujen hallinta", "Wrench", "/$plant/acme/settings", "Tool life limits at this plant", "Työkalujen käyttöikärajat tässä tehtaassa", { mod: "acme", langDe: "fi" })
        ] }
      ]
    },
    // A plant in onboarding adds this entry at the top of its plant area (rules 5.2; A0066).
    onboarding: E("onboarding", "Continue onboarding", "Onboarding fortsetzen", "ListTodo", "/$plant/core/onboarding", "Finish the steps before the plant opens", "Die Schritte abschließen, bevor das Werk öffnet"),
    // A company with no plant yet keeps its onboarding open, and its admin finds the company wizard first in the company
    // area (A0066 When the wizard is built and Where a signed-in user starts). Drawn as E06-S14 behaviour (rules 9.3.6).
    companyOnboarding: E("onboarding", "Continue onboarding", "Onboarding fortsetzen", "ListTodo", "/settings/$companyId/core/onboarding", "Finish the steps before the company opens", "Die Schritte abschließen, bevor das Unternehmen öffnet"),
    t: {
      en: {
        nav: "Settings", companyTitle: "Company settings", plantTitle: "{plant} settings", others: "Other settings",
        areaLink: "{name} settings", back: "Back to {plant}", backHome: "Back to your plants", unavailable: "(unavailable)", onboarding: "Onboarding",
        emptyTitle: "You have no settings to manage here",
        emptyText: "Settings show here when one of your roles lets you manage this company or plant. Ask a company admin if you need access."
      },
      de: {
        nav: "Einstellungen", companyTitle: "Unternehmenseinstellungen", plantTitle: "Einstellungen für {plant}", others: "Weitere Einstellungen",
        areaLink: "Einstellungen für {name}", back: "Zurück zu {plant}", backHome: "Zurück zu Ihren Werken", unavailable: "(nicht verfügbar)", onboarding: "Onboarding",
        emptyTitle: "Hier haben Sie keine Einstellungen zu verwalten",
        emptyText: "Einstellungen erscheinen hier, wenn eine Ihrer Rollen dieses Unternehmen oder Werk verwalten darf. Fragen Sie einen Unternehmensadministrator, wenn Sie Zugriff brauchen."
      }
    },
    // Companies and plants: the default data, and the D2 long-strings preset for the German frames
    data: {
      en: { companies: [{ name: "Acme AB", plants: ["Plant A", "Plant B", "Plant D"] }, { name: "Nordic Tools AB", plants: ["Plant C"] }], onboarding: ["Plant D"] },
      de: { companies: [{ name: "Oberschwäbische Präzisionswerkzeuge GmbH", plants: ["Präzisionsfertigung Oberschwaben Werk Süd", "Werk Biberach an der Riß"] }, { name: "Allgäuer Feinmechanik GmbH", plants: ["Werk Kempten"] }], onboarding: [] }
    }
  };
})();
