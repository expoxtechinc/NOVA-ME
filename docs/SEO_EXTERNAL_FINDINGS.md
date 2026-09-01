# SEO external findings captured 1 September 2026

## Google Search Central

Google’s [robots.txt introduction](https://developers.google.com/search/docs/crawling-indexing/robots/intro) says robots.txt manages crawler access and traffic; it is not a reliable mechanism for removing a URL from search results. Pages that must not appear should use `noindex` or authentication. The implementation therefore uses robots rules for crawl management and route-aware `noindex,nofollow` metadata for private routes.

Google’s [robots meta/X-Robots specification](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag) documents page-level `noindex` and serving controls, including `max-image-preview:large`. The implementation applies index/follow metadata to public routes and noindex metadata to private or administrative routes.

Google’s [structured-data introduction](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data) recommends JSON-LD and says structured data should describe visible page content; accurate, complete markup is preferable to unsupported or incomplete claims. The implementation emits conservative EducationalOrganization, WebSite, WebPage, and dynamic BreadcrumbList JSON-LD without fabricated ratings, accreditation, tuition, or reviews.

Schema.org’s [BreadcrumbList reference](https://schema.org/BreadcrumbList) defines ordered ListItem entries with positions and URLs. The implementation adds visible clickable breadcrumbs and matching JSON-LD on non-home public routes.

## Production deployment observation

The linked Vercel project is `nova-me`, project ID `prj_30Eys2FnlOsmK50xRzj8Z3RE2w5o`, under team `team_1ZNJyXBJQkkA9ZlruhSMgVYM`. Commit `942bbb91d189931c2d3c758a00d8aa4a7b9df119` created production deployment `dpl_7L5TTF4C5wiXnaugVvD7vQVqoyzE`, URL `https://nova-915bmwuf6-expoxtechincs-projects.vercel.app`; at the last check it was still in `BUILDING` state. The stable project alias is `https://nova-me-expoxtechincs-projects.vercel.app`.
