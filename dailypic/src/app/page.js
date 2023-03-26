"use client"
import Image from 'next/image'
import { Inter } from 'next/font/google'
import styles from './page.module.css'
import {useState,useEffect} from "react";
const inter = Inter({ subsets: ['latin'] })



export default function Home() {

  const [photoData,setPhotoData]=useState(null);
  useEffect(()=>{
fetchPhoto();
    async function fetchPhoto() {
      let today = new Date();
      let yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      yesterday=yesterday.toISOString().split('T')[0]
      today=today.toISOString().split('T')[0]
      let url = `https://api.nasa.gov/planetary/apod?date=${yesterday}&api_key=EWrEh3u0WEDyM2DyWRp1zb0VoGzH2XMxz1uszjQP`
  const res = await fetch(url);
  const data=await res.json();
  setPhotoData(data);
  console.log(data.url,yesterday);
}
  },[]);

  return (
    <main >
      <div className={styles.card2}>
        <h1 className={inter.className}>Today's Picture</h1>
        
      </div>
      
      {photoData && (
        <div className={styles.center}>
        <div className={styles.card} >
        <img 
          src={photoData.url}
          alt={photoData.title}
          className={styles.space}
        />
      </div></div>)}
      

    </main>
  )
}
