import React from 'react';
import asclepiusLogo from '../../assets/asclepiusLogo.png';
import {useTranslation} from 'react-i18next';
  
export const AuthHeader = () => {
  const { t } = useTranslation();
  return (
    <div className="auth-header">
      <img src={asclepiusLogo} alt="Asclepius Logo" className="auth-logo" />
      <h1>{t("app.general.welcome")}</h1>
      <p>{t("app.general.signIn")}</p>
    </div>
  );
};