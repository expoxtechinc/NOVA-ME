import { useEffect } from "react";
import { useLocation } from "wouter";

const SITE_URL = "https://novainternationaluniversity.vercel.app";
const DEFAULT_IMAGE = `${SITE_URL}/favicon.svg`;
const PUBLIC_INFO: Record<string, { title: string; description: string }> = {
  "/": { title: "Nova International University | Online Certificate Programs", description: "Nova International University offers structured online certificate programs, practical learning, measurable progress, and verifiable credentials." },
  "/about": { title: "About Nova International University | Certificate Education", description: "Learn about NIU’s certificate-only educational model, academic governance, learner support, and approach to verifiable credentials." },
  "/founder": { title: "Founder and President | Nova International University", description: "Meet the founder and president of Nova International University and learn about NIU’s educational purpose and certificate-only focus." },
  "/mission": { title: "Mission and Vision | Nova International University", description: "Explore Nova International University’s mission, vision, values, and commitment to accessible certificate learning." },
  "/values": { title: "Institutional Values | Nova International University", description: "Discover the institutional values that guide Nova International University’s certificate programs and learner experience." },
  "/schools": { title: "Schools and Departments | Nova International University", description: "Explore Nova International University’s academic structure and certificate-learning departments." },
  "/programs": { title: "Online Certificate Programs | Nova International University", description: "Browse Nova International University certificate programs for professional development, practical skills, and self-paced online learning." },
  "/courses": { title: "Online Certificate Courses | Nova International University", description: "Explore published NIU certificate courses, course outcomes, learning requirements, and structured online study options." },
  "/admissions": { title: "Admissions | Nova International University Certificate Programs", description: "Understand how to explore, join, and complete Nova International University’s certificate-only learning programs." },
  "/resources": { title: "Learning Resources | Nova International University", description: "Access public learning resources and guidance for online certificate study at Nova International University." },
  "/calendar": { title: "Academic Calendar | Nova International University", description: "Review public academic dates, learning cycles, and certificate-program information from Nova International University." },
  "/help": { title: "Help Center | Nova International University", description: "Find answers and support for Nova International University certificate programs, learning access, and credentials." },
  "/faqs": { title: "Frequently Asked Questions | Nova International University", description: "Get clear answers about NIU certificate programs, online learning, assessments, completion, and credential verification." },
  "/policies": { title: "Academic and Certificate Policies | Nova International University", description: "Read Nova International University’s public academic, certificate, privacy, terms, and accessibility information." },
  "/contact": { title: "Contact Nova International University", description: "Contact Nova International University for questions about certificate programs, learner support, and credential verification." },
  "/online-learning": { title: "How Online Learning Works | Nova International University", description: "Learn how NIU organises online certificate learning, structured courses, measurable progress, accessible materials, and protected learner records." },
  "/how-niu-certificates-are-verified": { title: "How NIU Certificates Are Verified | Nova International University", description: "Understand how Nova International University verifies legitimate certificates while limiting public information and preserving learner privacy." },
  "/verify": { title: "Verify an NIU Certificate | Nova International University", description: "Verify a Nova International University certificate using its credential identifier and view legitimate public verification details." },
};

function upsertMeta(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) { element = document.createElement("meta"); element.setAttribute(attribute, key); document.head.appendChild(element); }
  element.setAttribute("content", content);
}

function humanizeSlug(value: string) { return value.split("-").filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }

export default function SeoHead() {
  const [location] = useLocation();
  useEffect(() => {
    const pathname = location.split("?")[0].replace(/\/$/, "") || "/";
    const dynamicProgram = pathname.match(/^\/programs\/([^/]+)$/);
    const dynamicCourse = pathname.match(/^\/courses\/([^/]+)$/);
    const isPublic = Boolean(PUBLIC_INFO[pathname] || dynamicProgram || dynamicCourse);
    const route = PUBLIC_INFO[pathname] ?? (dynamicProgram ? { title: `${humanizeSlug(dynamicProgram[1])} | NIU Certificate Program`, description: `Explore the published ${humanizeSlug(dynamicProgram[1])} certificate program at Nova International University, including outcomes, requirements, duration, and verification information.` } : dynamicCourse ? { title: `${humanizeSlug(dynamicCourse[1])} | NIU Certificate Course`, description: `Review the published ${humanizeSlug(dynamicCourse[1])} certificate course from Nova International University.` } : { title: "Nova International University", description: "Nova International University certificate learning and verifiable credentials." });
    const canonical = `${SITE_URL}${pathname === "/" ? "/" : pathname}`;
    document.title = route.title;
    upsertMeta("name", "description", route.description);
    upsertMeta("name", "robots", isPublic ? "index,follow,max-image-preview:large" : "noindex,nofollow,noarchive");
    upsertMeta("property", "og:title", route.title);
    upsertMeta("property", "og:description", route.description);
    upsertMeta("property", "og:url", canonical);
    upsertMeta("property", "og:type", dynamicProgram || dynamicCourse ? "article" : "website");
    upsertMeta("property", "og:image", DEFAULT_IMAGE);
    upsertMeta("property", "og:image:alt", "Nova International University certificate learning");
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", route.title);
    upsertMeta("name", "twitter:description", route.description);
    upsertMeta("name", "twitter:image", DEFAULT_IMAGE);
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) { link = document.createElement("link"); link.rel = "canonical"; document.head.appendChild(link); }
    link.href = canonical;
    let structured = document.getElementById("niu-structured-data") as HTMLScriptElement | null;
    if (!structured) { structured = document.createElement("script"); structured.id = "niu-structured-data"; structured.type = "application/ld+json"; document.head.appendChild(structured); }
    structured.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "EducationalOrganization", "@id": `${SITE_URL}/#organization`, name: "Nova International University", alternateName: "NIU", url: SITE_URL, description: "A digital learning institution focused on structured certificate education, measurable progress, and verifiable credentials.", logo: DEFAULT_IMAGE, sameAs: ["https://www.facebook.com/share/1Dj6oYFsdv/"] },
        { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: SITE_URL, name: "Nova International University", publisher: { "@id": `${SITE_URL}/#organization` } },
        { "@type": "WebPage", url: canonical, name: route.title, description: route.description, isPartOf: { "@id": `${SITE_URL}/#website` } },
        ...(dynamicProgram || dynamicCourse ? [{ "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: SITE_URL }, { "@type": "ListItem", position: 2, name: dynamicProgram ? "Certificate Programs" : "Certificate Courses", item: `${SITE_URL}/${dynamicProgram ? "programs" : "courses"}` }, { "@type": "ListItem", position: 3, name: route.title.split(" |")[0], item: canonical }] }] : []),
      ],
    });
  }, [location]);
  return null;
}
