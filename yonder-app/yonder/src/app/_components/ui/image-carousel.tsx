'use client';

import { useState } from 'react';
import { MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import type { Swiper as SwiperType } from 'swiper';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

interface ImageCarouselProps {
  images: string[];
  alt?: string;
}

/**
 * Proxy HTTP images through our HTTPS API to avoid mixed content warnings
 */
function getProxiedImageUrl(url: string): string {
  if (!url) return url;
  // Only proxy HTTP URLs - HTTPS URLs can be loaded directly
  if (url.startsWith('http://')) {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

// Airbnb-style image carousel component
export function ImageCarousel({ images, alt = "Image" }: ImageCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(1);

  if (!images || images.length === 0) {
    return (
      <div className="aspect-[4/3] bg-muted flex items-center justify-center rounded-xl">
        <MapPin className="w-12 h-12 text-muted-foreground" />
      </div>
    );
  }

  const handleSlideChange = (swiper: SwiperType) => {
    setCurrentSlide(swiper.realIndex + 1);
  };

  return (
    <div className="relative aspect-[4/3] rounded-xl overflow-hidden group">
      <Swiper
        modules={[Navigation, Pagination]}
        navigation={{
          prevEl: '.swiper-button-prev-custom',
          nextEl: '.swiper-button-next-custom',
        }}
        pagination={{
          clickable: true,
          bulletClass: 'swiper-pagination-bullet-custom',
          bulletActiveClass: 'swiper-pagination-bullet-active-custom',
        }}
        spaceBetween={0}
        slidesPerView={1}
        loop={images.length > 1}
        onSlideChange={handleSlideChange}
        className="h-full w-full"
      >
        {images.map((image, index) => (
          <SwiperSlide key={index}>
            <div className="relative w-full h-full">
              <Image
                fill
                quality={100}
                unoptimized
                src={getProxiedImageUrl(image)}
                alt={`${alt} ${index + 1}`}
                className="object-cover transition-transform duration-300 hover:scale-105"
              />
            </div>
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Custom Navigation Buttons - Airbnb Style */}
      {images.length > 1 && (
        <>
          <button className="swiper-button-prev-custom absolute left-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-white hover:scale-110 cursor-pointer">
            <ChevronLeft className="w-4 h-4 text-gray-700" />
          </button>
          <button className="swiper-button-next-custom absolute right-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-white hover:scale-110 cursor-pointer">
            <ChevronRight className="w-4 h-4 text-gray-700" />
          </button>
        </>
      )}

      {/* Custom Pagination Dots - Airbnb Style */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
          <style jsx>{`
            .swiper-pagination-bullet-custom {
              width: 6px;
              height: 6px;
              border-radius: 50%;
              background: rgba(255, 255, 255, 0.5);
              margin: 0 2px;
              cursor: pointer;
              transition: all 0.2s ease;
            }
            .swiper-pagination-bullet-active-custom {
              background: white;
              transform: scale(1.2);
            }
          `}</style>
        </div>
      )}

      {/* Image counter - Bottom Right */}
      {images.length > 1 && (
        <div className="absolute bottom-4 right-4 z-10 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1">
          <span className="text-white text-sm font-medium">
            {currentSlide} / {images.length}
          </span>
        </div>
      )}
    </div>
  );
} 