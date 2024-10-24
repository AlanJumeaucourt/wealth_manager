import { Category } from '@/types/category';

export const expenseCategories: Category[] = [
  {
    name: "Abonnements",
    color: "#663A66",
    iconName: "tv-outline",
    iconSet: "Ionicons",
    subCategories: [
      { name: "Abonnements - Autres", iconName: "tv-outline", iconSet: "Ionicons" },
      { name: "Câble / Satellite", iconName: "tv-outline", iconSet: "Ionicons" },
      { name: "Internet", iconName: "globe-outline", iconSet: "Ionicons" },
      { name: "Téléphone fixe", iconName: "call-outline", iconSet: "Ionicons" },
      { name: "Téléphonie mobile", iconName: "phone-portrait-outline", iconSet: "Ionicons" }
    ]
  },
  {
    name: "Achats & Shopping",
    color: "#B6012E",
    iconName: "cart-outline",
    iconSet: "Ionicons",
    subCategories: [
      { name: "Achats & Shopping - Autres", iconName: "ellipsis-horizontal", iconSet: "Ionicons" },
      { name: "Articles de sport", iconName: "fitness-outline", iconSet: "Ionicons" },
      { name: "Cadeaux", iconName: "gift-outline", iconSet: "Ionicons" },
      { name: "Films & DVDs", iconName: "film-outline", iconSet: "Ionicons" },
      { name: "High Tech", iconName: "laptop-outline", iconSet: "Ionicons" },
      { name: "Licences", iconName: "key-outline", iconSet: "Ionicons" },
      { name: "Livres", iconName: "book-outline", iconSet: "Ionicons" },
      { name: "Musique", iconName: "musical-notes-outline", iconSet: "Ionicons" },
      { name: "Vêtements/Chaussures", iconName: "shirt-outline", iconSet: "Ionicons" }
    ]
  },
  {
    name: "Alimentation & Restauration",
    color: "#FFB200",
    iconName: "restaurant-outline",
    iconSet: "Ionicons",
    subCategories: [
      { name: "Alimentation & Restauration - Autres", iconName: "ellipsis-horizontal", iconSet: "Ionicons" },
      { name: "Café", iconName: "cafe-outline", iconSet: "Ionicons" },
      { name: "Fast foods", iconName: "fast-food-outline", iconSet: "Ionicons" },
      { name: "Restaurants", iconName: "restaurant-outline", iconSet: "Ionicons" },
      { name: "Supermarché / Epicerie", iconName: "cart-outline", iconSet: "Ionicons" }
    ]
  },
  {
    name: "Auto & Transports",
    color: "#00AAAA",
    iconName: "car-outline",
    iconSet: "Ionicons",
    subCategories: [
      { name: "Auto & Transports - Autres", iconName: "ellipsis-horizontal", iconSet: "Ionicons" },
      { name: "Assurance véhicule", iconName: "shield-checkmark-outline", iconSet: "Ionicons" },
      { name: "Billets d'avion", iconName: "airplane-outline", iconSet: "Ionicons" },
      { name: "Billets de train", iconName: "train-outline", iconSet: "Ionicons" },
      { name: "Carburant", iconName: "fuel", iconSet: "Ionicons" },
      { name: "Entretien véhicule", iconName: "construct-outline", iconSet: "Ionicons" },
      { name: "Location de véhicule", iconName: "car-outline", iconSet: "Ionicons" },
      { name: "Péage", iconName: "cash-outline", iconSet: "Ionicons" },
      { name: "Stationnement", iconName: "car-outline", iconSet: "Ionicons" },
      { name: "Transports en commun", iconName: "bus-outline", iconSet: "Ionicons" }
    ]
  },
  {
    name: "Banque",
    color: "#84593F",
    iconName: "wallet-outline",
    iconSet: "Ionicons",
    subCategories: [
      { name: "Banque - Autres", iconName: "ellipsis-horizontal", iconSet: "Ionicons" },
      { name: "Débit mensuel carte", iconName: "card-outline", iconSet: "Ionicons" },
      { name: "Epargne", iconName: "cash-outline", iconSet: "Ionicons" },
      { name: "Frais bancaires", iconName: "card-outline", iconSet: "Ionicons" },
      { name: "Hypothèque", iconName: "home-outline", iconSet: "Ionicons" },
      { name: "Incidents de paiement", iconName: "alert-circle-outline", iconSet: "Ionicons" },
      { name: "Services Bancaires", iconName: "card-outline", iconSet: "Ionicons" }
    ]
  },
  {
    name: "Divers",
    color: "#2C5162",
    iconName: "help-circle-outline",
    iconSet: "Ionicons",
    subCategories: [
      { name: "A catégoriser", iconName: "document-outline", iconSet: "Ionicons" },
      { name: "Assurance", iconName: "shield-checkmark-outline", iconSet: "Ionicons" },
      { name: "Autres dépenses", iconName: "ellipsis-horizontal", iconSet: "Ionicons" },
      { name: "Dons", iconName: "heart-outline", iconSet: "Ionicons" },
      { name: "Pressing", iconName: "print-outline", iconSet: "Ionicons" },
      { name: "Tabac", iconName: "logo-no-smoking", iconSet: "Ionicons" }
    ]
  },
  {
    name: "Esthétique & Soins",
    color: "#81003F",
    iconName: "cut-outline",
    iconSet: "Ionicons",
    subCategories: [
      { name: "Coiffeur", iconName: "cut-outline", iconSet: "Ionicons" },
      { name: "Cosmétique", iconName: "color-palette-outline", iconSet: "Ionicons" },
      { name: "Esthétique", iconName: "flower-outline", iconSet: "Ionicons" },
      { name: "Esthétique & Soins - Autres", iconName: "ellipsis-horizontal", iconSet: "Ionicons" },
      { name: "Spa & Massage", iconName: "water-outline", iconSet: "Ionicons" }
    ]
  },
  {
    name: "Impôts & Taxes",
    color: "#004E80",
    iconName: "cash-outline",
    iconSet: "Ionicons",
    subCategories: [
      { name: "Amendes", iconName: "alert-circle-outline", iconSet: "Ionicons" },
      { name: "Impôts & Taxes - Autres", iconName: "ellipsis-horizontal", iconSet: "Ionicons" },
      { name: "Impôts fonciers", iconName: "home-outline", iconSet: "Ionicons" },
      { name: "Impôts sur le revenu", iconName: "cash-outline", iconSet: "Ionicons" },
      { name: "Taxes", iconName: "receipt-outline", iconSet: "Ionicons" },
      { name: "TVA", iconName: "pricetag-outline", iconSet: "Ionicons" }
    ]
  },
  {
    name: "Logement",
    color: "#677FE0",
    iconName: "home-outline",
    iconSet: "Ionicons",
    subCategories: [
      { name: "Assurance habitation", iconName: "shield-checkmark-outline", iconSet: "Ionicons" },
      { name: "Charges diverses", iconName: "document-outline", iconSet: "Ionicons" },
      { name: "Décoration", iconName: "color-palette-outline", iconSet: "Ionicons" },
      { name: "Eau", iconName: "water-outline", iconSet: "Ionicons" },
      { name: "Electricité", iconName: "flash-outline", iconSet: "Ionicons" },
      { name: "Entretien", iconName: "hammer-outline", iconSet: "Ionicons" },
      { name: "Extérieur et jardin", iconName: "leaf-outline", iconSet: "Ionicons" },
      { name: "Gaz", iconName: "flame-outline", iconSet: "Ionicons" },
      { name: "Logement - Autres", iconName: "ellipsis-horizontal", iconSet: "Ionicons" },
      { name: "Loyer", iconName: "cash-outline", iconSet: "Ionicons" }
    ]
  },
  {
    name: "Loisirs & Sorties",
    color: "#773E8E",
    iconName: "game-controller-outline",
    iconSet: "Ionicons",
    subCategories: [
      { name: "Bars / Clubs", iconName: "beer-outline", iconSet: "Ionicons" },
      { name: "Divertissements", iconName: "film-outline", iconSet: "Ionicons" },
      { name: "Frais Animaux", iconName: "paw-outline", iconSet: "Ionicons" },
      { name: "Hobbies", iconName: "game-controller-outline", iconSet: "Ionicons" },
      { name: "Hôtels", iconName: "bed-outline", iconSet: "Ionicons" },
      { name: "Loisirs & Sorties - Autres", iconName: "ellipsis-horizontal", iconSet: "Ionicons" },
      { name: "Sortie au restaurant", iconName: "restaurant-outline", iconSet: "Ionicons" },
      { name: "Sorties culturelles", iconName: "musical-notes-outline", iconSet: "Ionicons" },
      { name: "Sport", iconName: "fitness-outline", iconSet: "Ionicons" },
      { name: "Sports d'hiver", iconName: "snow-outline", iconSet: "Ionicons" },
      { name: "Voyages / Vacances", iconName: "airplane-outline", iconSet: "Ionicons" }
    ]
  },
  {
    name: "Retraits, Chq. et Vir.",
    color: "#14A94E",
    iconName: "wallet-outline",
    iconSet: "Ionicons",
    subCategories: [
      { name: "Chèques", iconName: "document-outline", iconSet: "Ionicons" },
      { name: "Retraits", iconName: "cash-outline", iconSet: "Ionicons" },
      { name: "Virements", iconName: "swap-horizontal-outline", iconSet: "Ionicons" },
      { name: "Virements internes", iconName: "swap-horizontal-outline", iconSet: "Ionicons" }
    ]
  },
  {
    name: "Santé",
    color: "#9A0310",
    iconName: "medkit-outline",
    iconSet: "Ionicons",
    subCategories: [
      { name: "Dentiste", iconName: "medkit-outline", iconSet: "Ionicons" },
      { name: "Médecin", iconName: "medkit-outline", iconSet: "Ionicons" },
      { name: "Mutuelle", iconName: "medkit-outline", iconSet: "Ionicons" },
      { name: "Opticien / Ophtalmo.", iconName: "glasses-outline", iconSet: "Ionicons" },
      { name: "Pharmacie", iconName: "medkit-outline", iconSet: "Ionicons" },
      { name: "Santé - Autres", iconName: "ellipsis-horizontal", iconSet: "Ionicons" }
    ]
  },
  {
    name: "Scolarité & Enfants",
    color: "#7C3506",
    iconName: "school-outline",
    iconSet: "Ionicons",
    subCategories: [
      { name: "Baby-sitters & Crèches", iconName: "people-outline", iconSet: "Ionicons" },
      { name: "Ecole", iconName: "school-outline", iconSet: "Ionicons" },
      { name: "Fournitures scolaires", iconName: "pencil-outline", iconSet: "Ionicons" },
      { name: "Jouets", iconName: "game-controller-outline", iconSet: "Ionicons" },
      { name: "Logement étudiant", iconName: "home-outline", iconSet: "Ionicons" },
      { name: "Pensions", iconName: "cash-outline", iconSet: "Ionicons" },
      { name: "Prêt étudiant", iconName: "card-outline", iconSet: "Ionicons" },
      { name: "Scolarité & Enfants - Autres", iconName: "ellipsis-horizontal", iconSet: "Ionicons" }
    ]
  },
];

export const incomeCategories: Category[] = [
  { name: "Allocations et pensions", color: "#4FA81C", iconName: "cash-outline", iconSet: "Ionicons" },
  { name: "Autres rentrées", color: "#4FA81C", iconName: "cash-outline", iconSet: "Ionicons" },
  { name: "Dépôt d'argent", color: "#4FA81C", iconName: "cash-outline", iconSet: "Ionicons" },
  { name: "Loyers reçus", color: "#4FA81C", iconName: "home-outline", iconSet: "Ionicons" },
  { name: "Remboursements", color: "#4FA81C", iconName: "swap-horizontal-outline", iconSet: "Ionicons" },
  { name: "Retraite", color: "#4FA81C", iconName: "medkit-outline", iconSet: "Ionicons" },
  { name: "Salaires", color: "#4FA81C", iconName: "cash-outline", iconSet: "Ionicons" },
  { name: "Services", color: "#4FA81C", iconName: "briefcase-outline", iconSet: "Ionicons" },
  { name: "Subventions", color: "#4FA81C", iconName: "cash-outline", iconSet: "Ionicons" },
  { name: "Ventes", color: "#4FA81C", iconName: "cart-outline", iconSet: "Ionicons" },
  { name: "Virements internes", color: "#2196F3", iconName: "swap-horizontal-outline", iconSet: "Ionicons" }
];
