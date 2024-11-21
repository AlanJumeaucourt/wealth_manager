import { ArrowRight, Calendar, Clock, Menu, PieChart, Wallet, X } from 'lucide-react';
import { useState } from 'react';
import { ThemeToggle } from './components/ThemeToggle';

const App = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const features = [
    {
      title: "Account Tracking",
      description: "Monitor balances and transactions across multiple bank accounts and investment portfolios in one place.",
      icon: <Wallet className="w-6 h-6 mb-4 text-blue-600 dark:text-blue-400" />,
      image: "/homescreen-portrait.png",
      status: "In Development"
    },
    {
      title: "Investment Management",
      description: "View and analyze investment performance, asset allocation, and stock positions with detailed insights.",
      icon: <PieChart className="w-6 h-6 mb-4 text-blue-600 dark:text-blue-400" />,
      image: "/investments_1-portrait.png"
    },
    {
      title: "Smart Budgeting",
      description: "Set and track budgets for different expense categories, helping you manage spending effectively.",
      icon: <Calendar className="w-6 h-6 mb-4 text-blue-600 dark:text-blue-400" />,
      image: "/budget_expense-portrait.png"
    },
    {
      title: "Transaction History",
      description: "Access detailed view of all financial transactions, categorized and easily searchable.",
      icon: <Clock className="w-6 h-6 mb-4 text-blue-600 dark:text-blue-400" />,
      image: "/transactions-portrait.png"
    }
  ];

  const showcaseImages = [
    { src: "/stock_details_1-portrait.png", title: "Stock Details" },
    { src: "/investments_2-portrait.png", title: "Portfolio Overview" },
    { src: "/budget_income-portrait.png", title: "Income Tracking" },
    { src: "/add-investment-transaction-portrait.png", title: "Easy Investment Management" }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Navigation - Same as before */}
      <nav className="fixed top-0 w-full bg-white dark:bg-gray-900 shadow-sm dark:shadow-gray-800 z-50">
        {/* ... Navigation content remains the same ... */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-2xl font-bold text-blue-600">WealthManager</span>
              <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">Beta</span>
            </div>

            <div className="hidden md:flex items-center space-x-8">
              <ThemeToggle />
              <a href="#features" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition">Features</a>
              <a href="#showcase" className="text-gray-600 hover:text-blue-600 transition">Showcase</a>
              <a
                href="https://github.com/AlanJumeaucourt/wealth_manager"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center text-gray-600 hover:text-blue-600 transition"
              >
                <svg className="w-6 h-6 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                GitHub
              </a>
            </div>

            <div className="md:hidden flex items-center">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-gray-600 hover:text-blue-600 transition"
              >
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {isMenuOpen && (
          <div className="md:hidden bg-white dark:bg-gray-900 border-t dark:border-gray-800">
            <div className="px-4 pt-2 pb-3 space-y-1">
              <a href="#features" className="block px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 transition">
                Features
              </a>
              <a href="#showcase" className="block px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 transition">
                Showcase
              </a>
              <a
                href="https://github.com/AlanJumeaucourt/wealth_manager"
                target="_blank"
                rel="noopener noreferrer"
                className="block px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 transition"
              >
                GitHub
              </a>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section - Modified for tall images */}
      <section className="pt-24 pb-12 md:pt-32 md:pb-24 bg-gradient-to-br from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
            <div className="lg:w-1/2 text-center lg:text-left">
              <div className="mb-4">
                <span className="inline-block px-3 py-1 text-sm font-semibold text-blue-800 bg-blue-100 rounded-full mb-2">
                  Open Source
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
                Open Source
                <span className="text-blue-600"> Wealth Management</span>
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
                A free and open source platform to manage your wealth, track investments, and achieve your financial goals.
                Currently in active development.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <a
                  href="https://github.com/AlanJumeaucourt/wealth_manager"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-500 transition flex items-center justify-center"
                >
                  View on GitHub <ArrowRight className="ml-2 h-5 w-5" />
                </a>
                <button className="bg-white dark:bg-gray-800 text-blue-600 px-8 py-3 rounded-lg border-2 border-blue-600 hover:bg-blue-50 dark:hover:bg-gray-700 transition">
                  Learn More
                </button>
              </div>
            </div>
            <div className="lg:w-1/2 max-w-sm mx-auto">
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl opacity-20 blur-lg"></div>
                <img
                  src="/homescreen-portrait.png"
                  alt="WealthManager App"
                  className="relative rounded-2xl shadow-xl w-full h-auto max-h-[600px] object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section - Modified for tall images */}
      <section id="features" className="py-16 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Powerful Features</h2>
            <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Everything you need to manage your finances effectively in one place.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm hover:shadow-md transition border border-gray-100 dark:border-gray-700"
              >
                {feature.icon}
                <h3 className="text-xl font-semibold mb-2 dark:text-white">{feature.title}</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">{feature.description}</p>
                <div className="relative rounded-lg overflow-hidden">
                  <img
                    src={feature.image}
                    alt={feature.title}
                    className="w-full h-[400px] object-cover object-top"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Showcase Section - Modified for tall images */}
      <section id="showcase" className="py-16 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">App Showcase</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Experience the intuitive design and powerful features of WealthManager.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {showcaseImages.map((image, index) => (
              <div
                key={index}
                className="group relative rounded-xl overflow-hidden shadow-sm hover:shadow-md transition h-[500px]"
              >
                <img
                  src={image.src}
                  alt={image.title}
                  className="w-full h-full object-cover object-top"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <p className="text-white text-lg font-semibold">{image.title}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 dark:bg-black text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center mb-4">
                <h3 className="text-xl font-bold">WealthManager</h3>
                <span className="ml-2 px-2 py-1 text-xs bg-blue-600 rounded-full">Beta</span>
              </div>
              <p className="text-gray-400">An open source wealth management platform</p>
              <div className="mt-4 flex space-x-4">
                <a
                  href="https://github.com/AlanJumeaucourt/wealth_manager"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                </a>
              </div>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Features</h4>
              <ul className="space-y-2">
                <li>
                  <a href="#features" className="text-gray-400 hover:text-white transition flex items-center">
                    Account Tracking
                  </a>
                </li>
                <li><a href="#features" className="text-gray-400 hover:text-white transition">Investment Management</a></li>
                <li><a href="#features" className="text-gray-400 hover:text-white transition">Smart Budgeting</a></li>
                <li><a href="#features" className="text-gray-400 hover:text-white transition">Transaction History</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Project</h4>
              <ul className="space-y-2">
                <li>
                  <a
                    href="https://github.com/AlanJumeaucourt/wealth_manager"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white transition"
                  >
                    GitHub Repository
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/AlanJumeaucourt/wealth_manager/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white transition"
                  >
                    Report an Issue
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/AlanJumeaucourt/wealth_manager/blob/main/LICENSE"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white transition"
                  >
                    License
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Contribute</h4>
              <a
                href="https://github.com/AlanJumeaucourt/wealth_manager"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition block text-center mb-4"
              >
                Star on GitHub
              </a>
              <p className="text-gray-400 text-sm">
                Help us make wealth management accessible to everyone
              </p>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8 text-center">
            <p className="text-gray-400">© 2024 WealthManager. Open Source Project.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;