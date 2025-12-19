// src/components/Navigation.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import {useTranslation} from 'react-i18next';

const Navigation: React.FC = () => {
  const { t } = useTranslation();
  return (
    <nav>
      <ul>
        <li><Link to="/">{t("navigation.menu.home")}</Link></li>
      </ul>
    </nav>
  );
};

export default Navigation;