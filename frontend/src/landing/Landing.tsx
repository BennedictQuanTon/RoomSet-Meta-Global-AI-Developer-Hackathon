// Hero, problem, approach, features, stack, comparison, team.

import { useCallback, useState } from "react";
import { APP_PATH } from "../app/nav";
import { COMPARE_COLUMNS, COMPARE_NOTE, COMPARE_ROWS, FEATURES, HERO_SLIDES, ROADMAP, STACK, STATS, STEPS, TEAM, type Status } from "./content";
import { Hero, goToApp } from "./Hero";
import { Intro, shouldPlayIntro } from "./Intro";
import { LiveDemo } from "./LiveDemo";
import { Fade, Lines, Rule, Unveil } from "./motion";

function StatusTag({ status }: { status: Status }) {
  return <span className={`lp-tag lp-tag--${status.toLowerCase()}`}>{status}</span>;
}

function Eyebrow({ children }: { children: string }) {
  return <Fade><p className="t-label lp-eyebrow">{children}</p></Fade>;
}

export function Landing() {
  const [intro, setIntro] = useState(shouldPlayIntro);
  const [play, setPlay] = useState(!intro);
  const reveal = useCallback(() => setPlay(true), []);
  const done = useCallback(() => setIntro(false), []);

  return (
    <div className="lp">
      {intro && <Intro image={HERO_SLIDES[0].src} onReveal={reveal} onDone={done} />}
      <Hero play={play} />

      <main>
        <section className="lp-wrap lp-opening">
          <Eyebrow>Plan your sofa in your space</Eyebrow>
          <Lines className="t-heading" lines={["Make room for what fits.", "Try the sofa you actually want", "in a 3D plan of your own corner,", "before you buy it."]} />
        </section>

        <section id="problem" className="lp-wrap lp-section">
          <Rule />
          <div className="lp-split">
            <Eyebrow>The problem</Eyebrow>
            <Fade delay={0.1}>
              <p className="t-body lp-copy">
                A listing gives you three numbers. Your room gives you a radiator, a door swing and a wall that is shorter than you remember. Most of the time, you find out whether they agree on delivery day.
              </p>
            </Fade>
          </div>
          <div className="lp-stats">
            {STATS.map((stat, index) => (
              <Fade key={stat.value} delay={index * 0.1} className="lp-stat">
                <p className="t-display">{stat.value}</p>
                <p className="t-body-sm lp-copy">{stat.text}</p>
                <a className="t-label lp-link" href={stat.href} target="_blank" rel="noreferrer noopener">{stat.source}</a>
              </Fade>
            ))}
          </div>
          <Fade><p className="t-caption lp-muted lp-source-note">Industry and vendor surveys. Read them as a direction, not exact figures.</p></Fade>
        </section>

        <Unveil className="lp-bleed" src="/landing/empty-room.jpg" alt="An empty room with worn plaster walls and tall windows" parallax />

        <section id="approach" className="lp-wrap lp-section">
          <Eyebrow>The approach</Eyebrow>
          <Lines className="t-heading" lines={["Real dimensions.", "A simple room.", "Your own hands on the sofa."]} />
          <div className="lp-steps">
            {STEPS.map((step, index) => (
              <div key={step.number}>
                <Rule delay={index * 0.08} />
                <Fade className="lp-step" delay={0.1 + index * 0.08}>
                  <p className="t-label">{step.number}</p>
                  <h3 className="t-body lp-strong">{step.title}</h3>
                  <p className="t-body-sm lp-copy">{step.body}</p>
                </Fade>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="lp-section">
          <div className="lp-wrap">
            <Rule />
            <Eyebrow>Features</Eyebrow>
            <Lines className="t-heading" lines={["Move it yourself.", "Right here, on a real room."]} />
          </div>
          <Fade className="lp-wrap lp-demo-wrap"><LiveDemo /></Fade>

          <div className="lp-wrap">
            <div className="lp-grid">
              {FEATURES.map((feature, index) => (
                <article key={feature.title} className="lp-card">
                  <Unveil className="lp-card-image" src={feature.image} alt={feature.alt} delay={(index % 4) * 0.08} />
                  <Fade delay={(index % 4) * 0.08}>
                    <div className="lp-card-head">
                      <h3 className="t-caption lp-strong">{feature.title}</h3>
                      <StatusTag status={feature.status} />
                    </div>
                    <p className="t-body-sm lp-copy">{feature.body}</p>
                  </Fade>
                </article>
              ))}
            </div>

            <div className="lp-roadmap">
              <Eyebrow>Still in the workshop</Eyebrow>
              {ROADMAP.map((item, index) => (
                <div key={item.title}>
                  <Rule delay={index * 0.06} />
                  <Fade className="lp-row" delay={index * 0.06}>
                    <h3 className="t-body lp-strong">{item.title}</h3>
                    <p className="t-body-sm lp-copy">{item.body}</p>
                    <StatusTag status={item.status} />
                  </Fade>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="stack" className="lp-wrap lp-section">
          <Rule />
          <Eyebrow>Tech stack</Eyebrow>
          <Lines className="t-heading" lines={["Models read and suggest.", "Geometry does the measuring."]} />
          <div className="lp-table-scroll">
            <table className="lp-table">
              <thead><tr><th>Layer</th><th>Tool</th><th>Job</th><th>State</th></tr></thead>
              <tbody>
                {STACK.map((row) => (
                  <tr key={row.layer}>
                    <th scope="row">{row.layer}</th>
                    <td className="lp-strong-cell">{row.tool}</td>
                    <td>{row.role}</td>
                    <td><StatusTag status={row.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="compare" className="lp-wrap lp-section">
          <Rule />
          <Eyebrow>Compared</Eyebrow>
          <Lines className="t-heading" lines={["Other tools sell you their catalog", "or a new picture of your room.", "We start with the sofa you chose."]} />
          <div className="lp-table-scroll" tabIndex={0} role="region" aria-label="Comparison table, scrolls sideways">
            <table className="lp-table lp-compare">
              <thead>
                <tr>
                  <th aria-label="Feature" />
                  {COMPARE_COLUMNS.map((column, index) => <th key={column} className={index === 0 ? "is-us" : undefined}>{column}</th>)}
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    {row.cells.map((cell, index) => <td key={index} className={index === 0 ? "is-us" : undefined}>{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="t-caption lp-muted lp-source-note">{COMPARE_NOTE}</p>
        </section>

        <section id="team" className="lp-wrap lp-section">
          <Rule />
          <Eyebrow>Made by two people</Eyebrow>
          <div className="lp-team">
            {TEAM.map((person, index) => (
              <Fade key={person.github} delay={index * 0.1} className="lp-person">
                <h3 className="t-heading-lg lp-name">{person.name}</h3>
                <p className="t-caption">{person.role}</p>
                <p className="t-body-sm lp-copy">{person.focus}</p>
                <a className="t-label lp-link" href={`https://github.com/${person.github}`} target="_blank" rel="noreferrer noopener">GitHub / {person.github}</a>
              </Fade>
            ))}
          </div>
        </section>
      </main>

      <footer className="lp-wrap lp-footer">
        <Rule />
        <div className="lp-footer-row">
          <Lines as="p" className="t-display lp-closing" lines={["See if it fits."]} />
          <a className="lp-button" href={APP_PATH} onClick={goToApp}>Try Roomset</a>
        </div>
        <div className="lp-footer-meta t-caption lp-muted">
          <p>Built for the Meta Global AI Developer Hackathon, 2026.</p>
          <p>Room photos and sofa models: <a href="https://polyhaven.com/license" target="_blank" rel="noreferrer noopener">Poly Haven, CC0</a>. Sofas are placed in the photos as renders.</p>
        </div>
      </footer>
    </div>
  );
}
