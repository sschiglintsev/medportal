import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { Button, Card, Carousel, Modal } from 'antd';
import { useEffect, useState } from 'react';

import { formatDate } from '../../Core/date.utils';
import { fetchAnnouncements } from '../../Core/services/announcement.service';
import type { Announcement } from '../../Core/types/common';
import './NewsSection.scss';

export function NewsSection() {
  const [newsItems, setNewsItems] = useState<Announcement[]>([]);
  const [selectedItem, setSelectedItem] = useState<Announcement | null>(null);

  useEffect(() => {
    const loadAnnouncements = async () => {
      try {
        const data = await fetchAnnouncements();
        setNewsItems(data);
      } catch {
        setNewsItems([]);
      }
    };

    void loadAnnouncements();
  }, []);

  return (
    <section id="news" className="news-section">
      <div className="news-section__inner">
        <h3>Объявления больницы</h3>

        {newsItems.length > 0 ? (
          <Carousel
            dots
            arrows
            autoplay
            autoplaySpeed={5000}
            slidesToShow={3}
            slidesToScroll={1}
            infinite={newsItems.length > 3}
            responsive={[
              {
                breakpoint: 992,
                settings: {
                  slidesToShow: 2,
                  infinite: newsItems.length > 2,
                },
              },
              {
                breakpoint: 640,
                settings: {
                  slidesToShow: 1,
                  infinite: newsItems.length > 1,
                },
              },
            ]}
            className="news-section__carousel"
            prevArrow={
              <button type="button" className="news-section__arrow">
                <LeftOutlined />
              </button>
            }
            nextArrow={
              <button type="button" className="news-section__arrow">
                <RightOutlined />
              </button>
            }
          >
            {newsItems.map((item) => (
              <div key={item.id} className="news-section__slide">
                <Card
                  cover={
                    item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="news-section__image news-section__image--cover"
                      />
                    ) : (
                      <div className="news-section__image">Изображение</div>
                    )
                  }
                  className="news-section__card"
                >
                  <div className="news-section__date">{formatDate(item.published_date)}</div>
                  <h4>{item.title}</h4>
                  <p>{item.description}</p>
                  <Button type="link" onClick={() => setSelectedItem(item)}>
                    Подробнее -&gt;
                  </Button>
                </Card>
              </div>
            ))}
          </Carousel>
        ) : null}
        {newsItems.length === 0 ? <div className="news-section__empty">Пока нет опубликованных объявлений.</div> : null}
      </div>

      <Modal
        title={selectedItem?.title ?? 'Объявление'}
        open={Boolean(selectedItem)}
        onCancel={() => setSelectedItem(null)}
        footer={null}
        width={800}
        wrapClassName="news-section__modal-wrapper"
        destroyOnClose
      >
        {selectedItem ? (
          <div className="news-section__details">
            <div className="news-section__date">{formatDate(selectedItem.published_date)}</div>
            {selectedItem.image_url ? (
              <img
                src={selectedItem.image_url}
                alt={selectedItem.title}
                className="news-section__details-image"
              />
            ) : null}
            <p>{selectedItem.full_description}</p>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
