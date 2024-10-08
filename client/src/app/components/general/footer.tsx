// components/Footer.tsx

const Footer = () => {
    return (
      <footer className="w-full bg-white dark:bg-gray-900 py-6 px-8 mt-10">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-gray-600 dark:text-gray-300">
            © {new Date().getFullYear()} Whale Connected Ventures LLC. All rights reserved.
          </p>
        </div>
      </footer>
    );
  };
  
  export default Footer;
  