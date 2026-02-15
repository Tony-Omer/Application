axios.get("/api/weather")
  .then(response => {
    const data = response.data;
    const boxes = document.querySelectorAll(".country");

    data.forEach((weather, index) => {
      const p = boxes[index].querySelectorAll("p");

      p[0].innerText = `Temperature: ${weather.temperature} °C`;
      p[1].innerText = `Condition: ${weather.condition}`;
      p[2].innerText = `Humidity: ${weather.humidity}%`;
      p[3].innerText = `Wind Speed: ${weather.windSpeed} m/s`;
      p[4].innerText = `Feels Like: ${weather.feelsLike} °C`;
    });
  })
  .catch(err => {
    console.error(err);
  });
