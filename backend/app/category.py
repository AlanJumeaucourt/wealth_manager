from typing import TypedDict


class SubCategory(TypedDict):
    name: dict[str, str]
    iconName: str
    iconSet: str


class Category(TypedDict):
    name: dict[str, str]
    color: str
    iconName: str
    iconSet: str
    subCategories: list[SubCategory] | None


expense_categories: list[Category] = [
    {
        "name": {
            "fr": "Abonnements",
            "en": "Subscriptions",
        },
        "color": "#663A66",
        "iconName": "tv-outline",
        "iconSet": "Ionicons",
        "subCategories": [
            {
                "name": {
                    "fr": "Abonnements - Autres",
                    "en": "Subscriptions - Other",
                },
                "iconName": "tv-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Câble / Satellite",
                    "en": "Cable / Satellite",
                },
                "iconName": "tv-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Internet",
                    "en": "Internet",
                },
                "iconName": "globe-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Téléphone fixe",
                    "en": "Fixed phone",
                },
                "iconName": "call-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Téléphonie mobile",
                    "en": "Mobile phone",
                },
                "iconName": "phone-portrait-outline",
                "iconSet": "Ionicons",
            },
        ],
    },
    {
        "name": {
            "fr": "Achats & Shopping",
            "en": "Shopping & Purchases",
        },
        "color": "#B6012E",
        "iconName": "cart-outline",
        "iconSet": "Ionicons",
        "subCategories": [
            {
                "name": {
                    "fr": "Achats & Shopping - Autres",
                    "en": "Shopping & Purchases - Other",
                },
                "iconName": "ellipsis-horizontal",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Articles de sport",
                    "en": "Sports equipment",
                },
                "iconName": "fitness-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Cadeaux",
                    "en": "Gifts",
                },
                "iconName": "gift-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Musique",
                    "en": "Music",
                },
                "iconName": "musical-notes-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Vêtements/Chaussures",
                    "en": "Clothes/Shoes",
                },
                "iconName": "shirt-outline",
                "iconSet": "Ionicons",
            },
        ],
    },
    {
        "name": {
            "fr": "Alimentation & Restauration",
            "en": "Food & Restaurants",
        },
        "color": "#FFB200",
        "iconName": "restaurant-outline",
        "iconSet": "Ionicons",
        "subCategories": [
            {
                "name": {
                    "fr": "Alimentation & Restauration - Autres",
                    "en": "Food & Restaurants - Other",
                },
                "iconName": "ellipsis-horizontal",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Café",
                    "en": "Cafe",
                },
                "iconName": "cafe-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Fast foods",
                    "en": "Fast foods",
                },
                "iconName": "fast-food-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Restaurants",
                    "en": "Restaurants",
                },
                "iconName": "restaurant-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Supermarché / Epicerie",
                    "en": "Supermarket / Grocery",
                },
                "iconName": "cart-outline",
                "iconSet": "Ionicons",
            },
        ],
    },
    {
        "name": {
            "fr": "Auto & Transports",
            "en": "Auto & Transports",
        },
        "color": "#00AAAA",
        "iconName": "car-outline",
        "iconSet": "Ionicons",
        "subCategories": [
            {
                "name": {
                    "fr": "Auto & Transports - Autres",
                    "en": "Auto & Transports - Other",
                },
                "iconName": "ellipsis-horizontal",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Assurance véhicule",
                    "en": "Vehicle insurance",
                },
                "iconName": "shield-checkmark-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Billets d'avion",
                    "en": "Plane tickets",
                },
                "iconName": "airplane-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Billets de train",
                    "en": "Train tickets",
                },
                "iconName": "train-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Carburant",
                    "en": "Fuel",
                },
                "iconName": "fuel",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Entretien véhicule",
                    "en": "Vehicle maintenance",
                },
                "iconName": "construct-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Location de véhicule",
                    "en": "Vehicle rental",
                },
                "iconName": "car-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Péage",
                    "en": "Toll",
                },
                "iconName": "cash-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Stationnement",
                    "en": "Parking",
                },
                "iconName": "bus-outline",
                "iconSet": "Ionicons",
            },
        ],
    },
    {
        "name": {"fr": "Banque", "en": "Bank"},
        "color": "#84593F",
        "iconName": "wallet-outline",
        "iconSet": "Ionicons",
        "subCategories": [
            {
                "name": {
                    "fr": "Banque - Autres",
                    "en": "Bank - Other",
                },
                "iconName": "ellipsis-horizontal",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Débit mensuel carte",
                    "en": "Monthly card debit",
                },
                "iconName": "card-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Epargne",
                    "en": "Savings",
                },
                "iconName": "cash-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Frais bancaires",
                    "en": "Banking fees",
                },
                "iconName": "card-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Hypothèque",
                    "en": "Mortgage",
                },
                "iconName": "home-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Incidents de paiement",
                    "en": "Payment incidents",
                },
                "iconName": "alert-circle-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Services Bancaires",
                    "en": "Banking services",
                },
                "iconName": "card-outline",
                "iconSet": "Ionicons",
            },
        ],
    },
    {
        "name": {
            "fr": "Divers",
            "en": "Miscellaneous",
        },
        "color": "#2C5162",
        "iconName": "help-circle-outline",
        "iconSet": "Ionicons",
        "subCategories": [
            {
                "name": {
                    "fr": "A catégoriser",
                    "en": "To categorize",
                },
                "iconName": "document-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Assurance",
                    "en": "Insurance",
                },
                "iconName": "shield-checkmark-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Autres dépenses",
                    "en": "Other expenses",
                },
                "iconName": "ellipsis-horizontal",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Dons",
                    "en": "Donations",
                },
                "iconName": "heart-outline",
                "iconSet": "Ionicons",
            },
        ],
    },
    {
        "name": {"fr": "Esthétique & Soins", "en": "Esthetic & Care"},
        "color": "#81003F",
        "iconName": "cut-outline",
        "iconSet": "Ionicons",
        "subCategories": [
            {
                "name": {
                    "fr": "Coiffeur",
                    "en": "Hairdresser",
                },
                "iconName": "cut-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Cosmétique",
                    "en": "Cosmetics",
                },
                "iconName": "color-palette-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Esthétique",
                    "en": "Esthetic",
                },
                "iconName": "flower-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Esthétique & Soins - Autres",
                    "en": "Esthetic & Care - Other",
                },
                "iconName": "ellipsis-horizontal",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Spa & Massage",
                    "en": "Spa & Massage",
                },
                "iconName": "water-outline",
                "iconSet": "Ionicons",
            },
        ],
    },
    {
        "name": {
            "fr": "Impôts & Taxes",
            "en": "Taxes & Taxes",
        },
        "color": "#004E80",
        "iconName": "cash-outline",
        "iconSet": "Ionicons",
        "subCategories": [
            {
                "name": {
                    "fr": "Amendes",
                    "en": "Fines",
                },
                "iconName": "alert-circle-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Impôts & Taxes - Autres",
                    "en": "Taxes & Taxes - Other",
                },
                "iconName": "ellipsis-horizontal",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Impôts fonciers",
                    "en": "Real estate taxes",
                },
                "iconName": "home-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Impôts sur le revenu",
                    "en": "Income taxes",
                },
                "iconName": "cash-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {"fr": "Taxes", "en": "Taxes"},
                "iconName": "receipt-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {"fr": "TVA", "en": "VAT"},
                "iconName": "pricetag-outline",
                "iconSet": "Ionicons",
            },
        ],
    },
    {
        "name": {
            "fr": "Logement",
            "en": "Housing",
        },
        "color": "#677FE0",
        "iconName": "home-outline",
        "iconSet": "Ionicons",
        "subCategories": [
            {
                "name": {
                    "fr": "Assurance habitation",
                    "en": "Housing insurance",
                },
                "iconName": "shield-checkmark-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Charges diverses",
                    "en": "Miscellaneous charges",
                },
                "iconName": "document-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Décoration",
                    "en": "Decoration",
                },
                "iconName": "color-palette-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Eau",
                    "en": "Water",
                },
                "iconName": "water-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Electricité",
                    "en": "Electricity",
                },
                "iconName": "flash-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Entretien",
                    "en": "Maintenance",
                },
                "iconName": "hammer-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Extérieur et jardin",
                    "en": "Outside and garden",
                },
                "iconName": "leaf-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Gaz",
                    "en": "Gas",
                },
                "iconName": "flame-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Logement - Autres",
                    "en": "Housing - Other",
                },
                "iconName": "ellipsis-horizontal",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Loyer",
                    "en": "Rent",
                },
                "iconName": "cash-outline",
                "iconSet": "Ionicons",
            },
        ],
    },
    {
        "name": {
            "fr": "Loisirs & Sorties",
            "en": "Leisure & Outings",
        },
        "color": "#773E8E",
        "iconName": "game-controller-outline",
        "iconSet": "Ionicons",
        "subCategories": [
            {
                "name": {
                    "fr": "Bars / Clubs",
                    "en": "Bars / Clubs",
                },
                "iconName": "beer-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Divertissements",
                    "en": "Entertainment",
                },
                "iconName": "film-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Frais Animaux",
                    "en": "Animal expenses",
                },
                "iconName": "paw-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Hobbies",
                    "en": "Hobbies",
                },
                "iconName": "game-controller-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Hôtels",
                    "en": "Hotels",
                },
                "iconName": "bed-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Loisirs & Sorties - Autres",
                    "en": "Leisure & Outings - Other",
                },
                "iconName": "ellipsis-horizontal",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Sortie au restaurant",
                    "en": "Restaurant outing",
                },
                "iconName": "restaurant-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Sorties culturelles",
                    "en": "Cultural outings",
                },
                "iconName": "musical-notes-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Sport",
                    "en": "Sport",
                },
                "iconName": "fitness-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Sports d'hiver",
                    "en": "Winter sports",
                },
                "iconName": "snow-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Voyages / Vacances",
                    "en": "Travels / Vacations",
                },
                "iconName": "airplane-outline",
                "iconSet": "Ionicons",
            },
        ],
    },
    {
        "name": {
            "fr": "Retraits, Chq. et Vir.",
            "en": "Withdrawals, Checks and Transfers",
        },
        "color": "#14A94E",
        "iconName": "wallet-outline",
        "iconSet": "Ionicons",
        "subCategories": [
            {
                "name": {
                    "fr": "Chèques",
                    "en": "Checks",
                },
                "iconName": "document-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Retraits",
                    "en": "Withdrawals",
                },
                "iconName": "cash-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Virements",
                    "en": "Transfers",
                },
                "iconName": "swap-horizontal-outline",
                "iconSet": "Ionicons",
            },
        ],
    },
    {
        "name": {
            "fr": "Santé",
            "en": "Health",
        },
        "color": "#9A0310",
        "iconName": "medkit-outline",
        "iconSet": "Ionicons",
        "subCategories": [
            {
                "name": {
                    "fr": "Dentiste",
                    "en": "Dentist",
                },
                "iconName": "medkit-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Médecin",
                    "en": "Doctor",
                },
                "iconName": "medkit-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Opticien / Ophtalmo.",
                    "en": "Optician / Ophthalmologist",
                },
                "iconName": "glasses-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Pharmacie",
                    "en": "Pharmacy",
                },
                "iconName": "medkit-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Santé - Autres",
                    "en": "Health - Other",
                },
                "iconName": "ellipsis-horizontal",
                "iconSet": "Ionicons",
            },
        ],
    },
    {
        "name": {
            "fr": "Scolarité & Enfants",
            "en": "School & Children",
        },
        "color": "#7C3506",
        "iconName": "school-outline",
        "iconSet": "Ionicons",
        "subCategories": [
            {
                "name": {
                    "fr": "Baby-sitters & Crèches",
                    "en": "Baby-sitters & Crèches",
                },
                "iconName": "people-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Ecole",
                    "en": "School",
                },
                "iconName": "school-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Fournitures scolaires",
                    "en": "School supplies",
                },
                "iconName": "pencil-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Jouets",
                    "en": "Toys",
                },
                "iconName": "game-controller-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Logement étudiant",
                    "en": "Student housing",
                },
                "iconName": "home-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Pensions",
                    "en": "Pensions",
                },
                "iconName": "cash-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Prêt étudiant",
                    "en": "Student loan",
                },
                "iconName": "card-outline",
                "iconSet": "Ionicons",
            },
            {
                "name": {
                    "fr": "Scolarité & Enfants - Autres",
                    "en": "School & Children - Other",
                },
                "iconName": "ellipsis-horizontal",
                "iconSet": "Ionicons",
            },
        ],
    },
]

income_categories: list[Category] = [
    {
        "name": {
            "fr": "Investissements",
            "en": "Investments",
        },
        "color": "#4FA81C",
        "iconName": "cash-outline",
        "iconSet": "Ionicons",
        "subCategories": None,
    },
    {
        "name": {
            "fr": "Allocations et pensions",
            "en": "Allocations and pensions",
        },
        "color": "#4FA81C",
        "iconName": "cash-outline",
        "iconSet": "Ionicons",
        "subCategories": None,
    },
    {
        "name": {
            "fr": "Autres rentrées",
            "en": "Other income",
        },
        "color": "#4FA81C",
        "iconName": "cash-outline",
        "iconSet": "Ionicons",
        "subCategories": None,
    },
    {
        "name": {
            "fr": "Dépôt d'argent",
            "en": "Cash deposit",
        },
        "color": "#4FA81C",
        "iconName": "cash-outline",
        "iconSet": "Ionicons",
        "subCategories": None,
    },
    {
        "name": {
            "fr": "Loyers reçus",
            "en": "Rents received",
        },
        "color": "#4FA81C",
        "iconName": "home-outline",
        "iconSet": "Ionicons",
        "subCategories": None,
    },
    {
        "name": {
            "fr": "Remboursements",
            "en": "Refunds",
        },
        "color": "#4FA81C",
        "iconName": "swap-horizontal-outline",
        "iconSet": "Ionicons",
        "subCategories": None,
    },
    {
        "name": {
            "fr": "Retraite",
            "en": "Retirement",
        },
        "color": "#4FA81C",
        "iconName": "medkit-outline",
        "iconSet": "Ionicons",
        "subCategories": None,
    },
    {
        "name": {
            "fr": "Salaires",
            "en": "Salaries",
        },
        "color": "#4FA81C",
        "iconName": "cash-outline",
        "iconSet": "Ionicons",
        "subCategories": None,
    },
    {
        "name": {
            "fr": "Services",
            "en": "Services",
        },
        "color": "#4FA81C",
        "iconName": "briefcase-outline",
        "iconSet": "Ionicons",
        "subCategories": None,
    },
    {
        "name": {
            "fr": "Subventions",
            "en": "Subventions",
        },
        "color": "#4FA81C",
        "iconName": "cash-outline",
        "iconSet": "Ionicons",
        "subCategories": None,
    },
    {
        "name": {
            "fr": "Ventes",
            "en": "Sales",
        },
        "color": "#4FA81C",
        "iconName": "cart-outline",
        "iconSet": "Ionicons",
        "subCategories": None,
    },
]

transfer_categories: list[Category] = [
    {
        "name": {
            "fr": "Virements internes",
            "en": "Internal transfers",
        },
        "color": "#2196F3",
        "iconName": "swap-horizontal-outline",
        "iconSet": "Ionicons",
        "subCategories": None,
    },
]
