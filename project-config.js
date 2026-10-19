// Settings for project.html. Anything left empty is simply not shown.
window.PROJECT_CONFIG = {
  // Links to the demonstrator pages
  dashboardUrl: "dashboard.html",
  twinUrl: "twin.html",

  // PARTNERS row under the headline. Add a logo file (path relative to this folder) to show the logo instead of the name.
  // Use the official logo files supplied by each organisation and follow their brand guidelines.
  partners: [
    { name: "Far UK", logo: "assets/far-uk-logo.png", url: "" },                                                  // e.g. logo: "assets/far-uk-logo.svg"
    { name: "Cardiff Metropolitan University", logo: "assets/cardiff-met-logo.svg", url: "https://www.cardiffmet.ac.uk" } // e.g. logo: "assets/cardiff-met-logo.svg"
  ],

  // FUNDING section: appears as soon as funder or name is filled in
  fund: {
    name: "",                 // name of the fund or call
    funder: "",               // e.g. the funding body
    programme: "",
    reference: "",            // grant / project reference
    amount: "",               // e.g. "£250,000"
    duration: "",             // e.g. "18 months, 2026 to 2027"
    summary: "",              // 2 to 3 sentences on what the funding supports
    acknowledgement: "",      // the wording the funder asks you to use
    logo: "",                 // e.g. "assets/funder-logo.svg"
    url: ""                   // link to the fund's page
  },

  // PEOPLE section: grouped by organisation, in the order given (people without an organisation appear under "Project team").
  // Add role, organisation, bio, photo ("assets/people/name.jpg") and url to each entry when you have them.
  people: [
    { name: "Wai Keung Fung" },
    { name: "Chaminda Hewage" },
    { name: "Jasim Uddin" },
    { name: "Udayanga Galappaththi" }
  ],

  // Contact line in the footer (shown when contactEmail is set)
  contactName: "",
  contactEmail: "",
  contactNote: ""
};
