import './Footer.scss';

export function Footer() {
  return (
    <footer className="promo-footer">
      <div className="promo-footer__inner">
        <div className="promo-footer__col">
          <div className="promo-footer__logo">Лого</div>
        </div>

        <div className="promo-footer__col">
          <h5>Навигация</h5>
          <a href="#hero">Главные</a>
          <a href="#news">Новости</a>
          <a href="#documents">Документы</a>
        </div>

        <div className="promo-footer__col">
          <h5>Контакты</h5>
          <p>Телефон: +7 (347) 000-00-00</p>
          <p>Email: info@gdkb17.ru</p>
        </div>
      </div>

      <div className="promo-footer__bottom">
        <span>ГБУЗ РБ ГДКБ №17, г. Уфа</span>
        <a href="#">Политика конфиденциальности</a>
        <a href="#">Пользовательское соглашение</a>
      </div>
    </footer>
  );
}
