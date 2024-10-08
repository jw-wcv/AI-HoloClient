// components/Header.tsx

const Header = () => {
    return (
      <header className="w-full bg-white dark:bg-gray-900 shadow-md py-4 px-8">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">
            AI.DE - Powered by Shadow.ai
          </h1>
          <nav>
            <ul className="flex items-center space-x-4">
              <li>
                <a href="#" className="text-gray-800 dark:text-white hover:text-blue-500 transition-colors">
                  Home
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-800 dark:text-white hover:text-blue-500 transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-800 dark:text-white hover:text-blue-500 transition-colors">
                  Pricing
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-800 dark:text-white hover:text-blue-500 transition-colors">
                  Contact
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </header>
    );
  };
  
  export default Header;
  